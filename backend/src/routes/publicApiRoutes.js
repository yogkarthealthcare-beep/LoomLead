const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateApiKey, requireScope } = require('../middleware/apiKeyAuth');
const hygieneService = require('../services/hygieneService');
const webhookService = require('../services/webhookService');
const scoringQueue = require('../services/scoringQueue');

// All endpoints in this router require a valid Tenant API Key
router.use(authenticateApiKey);

// =========================================================================
// 1. LIST LEADS (leads:read)
// =========================================================================
router.get('/leads', requireScope('leads:read'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : null;
    const status = req.query.status ? req.query.status.trim() : null;
    const category = req.query.category ? req.query.category.trim() : null;

    let query = `
      SELECT id, name, phone, email, company_name, category, website, address, city,
             status, score, score_value, budget_value, source, created_at, updated_at
      FROM leads
      WHERE tenant_id = $1 AND is_deleted = FALSE
    `;
    const params = [req.tenantId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (name ILIKE $${params.length} OR company_name ILIKE $${params.length} OR phone LIKE $${params.length} OR email ILIKE $${params.length})`;
    }

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (category && category !== 'All') {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get count
    let countQuery = `SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE`;
    const countParams = [req.tenantId];
    if (search) {
      countParams.push(`%${search}%`);
      countQuery += ` AND (name ILIKE $2 OR company_name ILIKE $2 OR phone LIKE $2 OR email ILIKE $2)`;
    }
    const countRes = await db.query(countQuery, countParams);
    const total = parseInt(countRes.rows[0].count, 10);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[PublicAPI] List leads error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 2. GET SINGLE LEAD (leads:read)
// =========================================================================
router.get('/leads/:id', requireScope('leads:read'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, name, phone, email, company_name, category, website, address, city,
              status, score, score_value, score_breakdown, budget_value, source, sources,
              notes, created_at, updated_at, last_seen_at
       FROM leads
       WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [id, req.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: `Lead not found with ID '${id}'.` });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[PublicAPI] Get lead error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. CREATE LEAD WITH DEDUPLICATION (leads:write)
// =========================================================================
router.post('/leads', requireScope('leads:write'), async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      company_name,
      category,
      website,
      address,
      city,
      status,
      budget_value,
      notes,
      source
    } = req.body;

    if (!name || (!phone && !email)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed: "name" and at least one contact channel ("phone" or "email") are required.'
      });
    }

    // Ingest through Data Hygiene engine (normalizes phone/domain, deduplicates, merges)
    const upsertResult = await hygieneService.upsertLead(req.tenantId, {
      name: name.trim(),
      phone: phone ? phone.trim() : null,
      email: email ? email.trim() : null,
      company_name: company_name ? company_name.trim() : (name.trim() || 'N/A'),
      category: category ? category.trim() : 'Business & Commercial',
      website: website ? website.trim() : null,
      address: address ? address.trim() : null,
      city: city ? city.trim() : 'India',
      status: status || 'New',
      budget_value: parseFloat(budget_value) || 0,
      notes: notes || null,
      source: source || 'Public API'
    });

    const lead = upsertResult.lead;

    // If new lead was created, trigger outgoing webhook 'lead.created'
    if (upsertResult.action === 'created') {
      webhookService.dispatch(req.tenantId, 'lead.created', {
        id: lead.id,
        name: lead.name,
        company_name: lead.company_name,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        score: lead.score,
        score_value: lead.score_value,
        source: lead.source,
        created_at: lead.created_at
      });
    }

    res.status(upsertResult.action === 'created' ? 201 : 200).json({
      success: true,
      action: upsertResult.action, // 'created' or 'merged'
      is_duplicate: upsertResult.isDuplicate,
      data: lead
    });
  } catch (err) {
    console.error('[PublicAPI] Create lead error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 4. UPDATE LEAD (leads:write)
// =========================================================================
router.patch('/leads/:id', requireScope('leads:write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, company_name, category, website, address, city, budget_value } = req.body;

    const existingRes = await db.query(
      `SELECT * FROM leads WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [id, req.tenantId]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: `Lead not found with ID '${id}'.` });
    }

    const current = existingRes.rows[0];

    const updatedRes = await db.query(
      `UPDATE leads
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           email = COALESCE($3, email),
           company_name = COALESCE($4, company_name),
           category = COALESCE($5, category),
           website = COALESCE($6, website),
           address = COALESCE($7, address),
           city = COALESCE($8, city),
           budget_value = COALESCE($9, budget_value),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND tenant_id = $11
       RETURNING *`,
      [
        name ? name.trim() : null,
        phone ? phone.trim() : null,
        email ? email.trim() : null,
        company_name ? company_name.trim() : null,
        category ? category.trim() : null,
        website ? website.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        budget_value !== undefined ? parseFloat(budget_value) : null,
        id,
        req.tenantId
      ]
    );

    const updatedLead = updatedRes.rows[0];

    // Enqueue for score recalculation
    scoringQueue.enqueue(req.tenantId, id);

    res.json({ success: true, data: updatedLead });
  } catch (err) {
    console.error('[PublicAPI] Update lead error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. ADD NOTES TO LEAD (leads:write)
// =========================================================================
router.post('/leads/:id/notes', requireScope('leads:write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, error: 'Note text is required.' });
    }

    const existingRes = await db.query(
      `SELECT id, notes FROM leads WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [id, req.tenantId]
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: `Lead not found with ID '${id}'.` });
    }

    const existingNotes = existingRes.rows[0].notes || '';
    const timestamp = new Date().toISOString().split('T')[0];
    const newNoteEntry = `[Note ${timestamp}]: ${note.trim()}`;
    const combinedNotes = existingNotes ? `${existingNotes}\n${newNoteEntry}` : newNoteEntry;

    const updateRes = await db.query(
      `UPDATE leads SET notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id, name, notes`,
      [combinedNotes, id, req.tenantId]
    );

    res.json({
      success: true,
      message: 'Note added successfully.',
      data: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[PublicAPI] Add note error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 6. MOVE STAGE / STATUS (leads:write)
// =========================================================================
router.post('/leads/:id/stage', requireScope('leads:write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { stage } = req.body;

    const validStages = ['New', 'Contacted', 'Qualified', 'Won', 'Lost'];
    if (!stage || !validStages.includes(stage)) {
      return res.status(400).json({
        success: false,
        error: `Invalid stage '${stage}'. Allowed stages: ${validStages.join(', ')}`
      });
    }

    const leadRes = await db.query(
      `SELECT id, name, company_name, phone, email, status, score, score_value, budget_value
       FROM leads 
       WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [id, req.tenantId]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: `Lead not found with ID '${id}'.` });
    }

    const previousStage = leadRes.rows[0].status;

    if (previousStage === stage) {
      return res.json({
        success: true,
        message: `Lead is already in stage '${stage}'.`,
        previous_stage: previousStage,
        current_stage: stage,
        data: leadRes.rows[0]
      });
    }

    const updateRes = await db.query(
      `UPDATE leads 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND tenant_id = $3 
       RETURNING id, name, company_name, phone, email, status, score, score_value, budget_value`,
      [stage, id, req.tenantId]
    );

    const updatedLead = updateRes.rows[0];

    // Trigger Outgoing Webhook: lead.stage_changed
    webhookService.dispatch(req.tenantId, 'lead.stage_changed', {
      lead_id: id,
      previous_stage: previousStage,
      new_stage: stage,
      lead: updatedLead
    });

    // If stage moved to 'Won', trigger specific webhook: lead.won
    if (stage === 'Won') {
      webhookService.dispatch(req.tenantId, 'lead.won', {
        lead_id: id,
        name: updatedLead.name,
        company_name: updatedLead.company_name,
        phone: updatedLead.phone,
        email: updatedLead.email,
        deal_value: updatedLead.budget_value,
        won_at: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: `Lead stage changed from '${previousStage}' to '${stage}'.`,
      previous_stage: previousStage,
      current_stage: stage,
      data: updatedLead
    });
  } catch (err) {
    console.error('[PublicAPI] Move stage error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
