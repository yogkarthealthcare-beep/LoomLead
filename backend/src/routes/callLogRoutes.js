const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get All Call Logs for Tenant or Specific Lead
router.get('/', authenticateToken, async (req, res) => {
  const { lead_id, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `SELECT c.*, l.name as lead_name, l.phone as lead_phone, u.name as caller_name
                 FROM call_logs c
                 JOIN leads l ON c.lead_id = l.id
                 JOIN users u ON c.user_id = u.id
                 WHERE c.tenant_id = $1`;
    const params = [req.tenantId];

    if (lead_id) {
      params.push(lead_id);
      query += ` AND c.lead_id = $${params.length}`;
    }

    query += ` ORDER BY c.call_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ success: true, calls: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Record New Call Log
router.post('/', authenticateToken, async (req, res) => {
  const { lead_id, direction = 'outbound', duration_seconds = 0, outcome, notes, recording_url } = req.body;

  if (!lead_id || !outcome) {
    return res.status(400).json({ success: false, message: 'Lead ID and Outcome are required.' });
  }

  try {
    const insertRes = await db.query(
      `INSERT INTO call_logs (tenant_id, lead_id, user_id, direction, duration_seconds, outcome, notes, recording_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.tenantId, lead_id, req.user.id, direction, duration_seconds, outcome, notes || null, recording_url || null]
    );

    // Update lead's updated_at timestamp
    await db.query(`UPDATE leads SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [lead_id]);

    res.status(201).json({ success: true, callLog: insertRes.rows[0], message: 'Call log recorded successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
