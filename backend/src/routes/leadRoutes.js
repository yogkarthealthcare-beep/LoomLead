const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkPlanLimit } = require('../middleware/planGatingMiddleware');
const hygieneService = require('../services/hygieneService');
const suppressionService = require('../services/suppressionService');

// Get All Leads with Filters, Search, Sort & Pagination
router.get('/', authenticateToken, async (req, res) => {
  const { search, score, status, source, city, category, page = 1, limit = 50, sort = 'created_at', order = 'DESC' } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `SELECT l.*, ps.name as stage_name, ps.color_hex as stage_color, u.name as assigned_to_name,
                        CASE WHEN s.id IS NOT NULL THEN TRUE ELSE FALSE END as is_dnd,
                        s.reason as dnd_reason
                 FROM leads l
                 LEFT JOIN pipeline_stages ps ON l.stage_id = ps.id
                 LEFT JOIN users u ON l.assigned_to_user_id = u.id
                 LEFT JOIN suppression_list s ON s.tenant_id = l.tenant_id 
                   AND ((s.type = 'phone' AND (s.value = l.normalized_phone OR s.value = l.phone)) 
                        OR (s.type = 'email' AND l.email IS NOT NULL AND s.value = LOWER(l.email)))
                 WHERE l.tenant_id = $1 AND l.is_deleted = FALSE`;
    const params = [req.tenantId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (l.name ILIKE $${params.length} OR l.phone ILIKE $${params.length} OR l.email ILIKE $${params.length} OR l.company_name ILIKE $${params.length} OR l.category ILIKE $${params.length})`;
    }

    if (score && score !== 'All') {
      params.push(score);
      query += ` AND l.score = $${params.length}`;
    }

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND l.status = $${params.length}`;
    }

    if (category && category !== 'All') {
      params.push(category);
      query += ` AND l.category = $${params.length}`;
    }

    if (source && source !== 'All') {
      params.push(source);
      query += ` AND l.source = $${params.length}`;
    }

    if (city && city !== 'All') {
      params.push(city);
      query += ` AND l.city = $${params.length}`;
    }

    // Sort order validation
    const validSortCols = ['name', 'created_at', 'budget_value', 'next_followup_at', 'score', 'status', 'category'];
    const sortCol = validSortCols.includes(sort) ? `l.${sort}` : 'l.created_at';
    const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortCol} ${sortDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const leadsRes = await db.query(query, params);
    const countRes = await db.query(
      `SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE`,
      [req.tenantId]
    );

    res.json({
      success: true,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
      leads: leadsRes.rows,
    });
  } catch (error) {
    console.error('Leads fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leads.' });
  }
});

// Create New Lead Manually (with Deduplication & Normalization)
router.post('/', authenticateToken, async (req, res) => {
  const { name, phone, email, company_name, category, source, status, score, budget_value, notes, website } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Name and phone are required.' });
  }

  try {
    const leadData = {
      name,
      phone,
      email: email || null,
      company_name: company_name || name,
      category: category || 'Business & Commercial',
      source: source || 'Manual Entry',
      status: status || 'New',
      score: score || 'Warm',
      budget_value: budget_value || 0,
      notes: notes || null,
      website: website || null
    };

    const result = await hygieneService.upsertLead(db, req.tenantId, leadData, null, req.user.id);

    res.json({
      success: true,
      lead: result.lead,
      action: result.action,
      isDuplicate: result.isDuplicate,
      merged: result.merged,
      message: result.merged ? 'Existing lead found: enriched with new details without duplication.' : 'Lead added successfully.'
    });
  } catch (err) {
    console.error('Lead create error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Single Lead 360 Details (with Call Logs, Tasks, Quotes)
router.get('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const leadRes = await db.query(
      `SELECT l.*, ps.name as stage_name, u.name as assigned_to_name
       FROM leads l
       LEFT JOIN pipeline_stages ps ON l.stage_id = ps.id
       LEFT JOIN users u ON l.assigned_to_user_id = u.id
       WHERE l.id = $1 AND l.tenant_id = $2 AND l.is_deleted = FALSE`,
      [id, req.tenantId]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const lead = leadRes.rows[0];

    // Fetch related calls
    const callsRes = await db.query(
      `SELECT c.*, u.name as caller_name FROM call_logs c 
       LEFT JOIN users u ON c.user_id = u.id 
       WHERE c.lead_id = $1 AND c.tenant_id = $2 ORDER BY c.call_date DESC`,
      [id, req.tenantId]
    );

    // Fetch related tasks
    const tasksRes = await db.query(
      `SELECT t.*, u.name as assigned_name FROM tasks t 
       LEFT JOIN users u ON t.assigned_to_user_id = u.id 
       WHERE t.lead_id = $1 AND t.tenant_id = $2 ORDER BY t.due_date ASC`,
      [id, req.tenantId]
    );

    res.json({
      success: true,
      lead,
      calls: callsRes.rows,
      tasks: tasksRes.rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Lead Details
router.put('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, company_name, category, score, status, stage_id, budget_value, notes, next_followup_at } = req.body;

  try {
    const updateRes = await db.query(
      `UPDATE leads 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email),
           company_name = COALESCE($4, company_name),
           category = COALESCE($5, category),
           score = COALESCE($6, score),
           status = COALESCE($7, status),
           stage_id = COALESCE($8, stage_id),
           budget_value = COALESCE($9, budget_value),
           notes = COALESCE($10, notes),
           next_followup_at = COALESCE($11, next_followup_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $12 AND tenant_id = $13
       RETURNING *`,
      [name, phone, email, company_name, category, score, status, stage_id, budget_value, notes, next_followup_at, id, req.tenantId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    res.json({ success: true, lead: updateRes.rows[0], message: 'Lead updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete Lead (Soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      `UPDATE leads SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2`,
      [id, req.tenantId]
    );
    res.json({ success: true, message: 'Lead deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Bulk Action on Leads (Assign, Change Status, Delete)
router.post('/bulk', authenticateToken, async (req, res) => {
  const { lead_ids, action, value } = req.body;
  if (!Array.isArray(lead_ids) || lead_ids.length === 0) {
    return res.status(400).json({ success: false, message: 'No leads selected.' });
  }

  try {
    if (action === 'delete') {
      await db.query(
        `UPDATE leads SET is_deleted = TRUE WHERE id = ANY($1::uuid[]) AND tenant_id = $2`,
        [lead_ids, req.tenantId]
      );
    } else if (action === 'change_status') {
      await db.query(
        `UPDATE leads SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::uuid[]) AND tenant_id = $3`,
        [value, lead_ids, req.tenantId]
      );
    } else if (action === 'reassign') {
      await db.query(
        `UPDATE leads SET assigned_to_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2::uuid[]) AND tenant_id = $3`,
        [value, lead_ids, req.tenantId]
      );
    }

    res.json({ success: true, message: `Bulk action '${action}' applied to ${lead_ids.length} leads.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
