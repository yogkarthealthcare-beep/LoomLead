const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get All Tasks for Tenant
router.get('/', authenticateToken, async (req, res) => {
  const { status, priority, type, due_today } = req.query;

  try {
    let query = `SELECT t.*, l.name as lead_name, l.phone as lead_phone, u.name as assigned_name
                 FROM tasks t
                 LEFT JOIN leads l ON t.lead_id = l.id
                 LEFT JOIN users u ON t.assigned_to_user_id = u.id
                 WHERE t.tenant_id = $1`;
    const params = [req.tenantId];

    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      query += ` AND t.priority = $${params.length}`;
    }

    if (type) {
      params.push(type);
      query += ` AND t.type = $${params.length}`;
    }

    if (due_today === 'true') {
      query += ` AND t.due_date::date = CURRENT_DATE`;
    }

    query += ` ORDER BY t.due_date ASC`;

    const result = await db.query(query, params);
    res.json({ success: true, tasks: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create New Task
router.post('/', authenticateToken, async (req, res) => {
  const { lead_id, title, type = 'Call', priority = 'Medium', due_date, notes } = req.body;

  if (!title || !due_date) {
    return res.status(400).json({ success: false, message: 'Title and due date are required.' });
  }

  try {
    const insertRes = await db.query(
      `INSERT INTO tasks (tenant_id, lead_id, assigned_to_user_id, title, type, priority, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.tenantId, lead_id || null, req.user.id, title, type, priority, due_date, notes || null]
    );

    res.status(201).json({ success: true, task: insertRes.rows[0], message: 'Task created successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mark Task Completed
router.patch('/:id/complete', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const updateRes = await db.query(
      `UPDATE tasks 
       SET status = 'Completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.tenantId]
    );

    res.json({ success: true, task: updateRes.rows[0], message: 'Task marked as completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
