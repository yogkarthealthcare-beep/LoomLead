const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Middleware to enforce Super Admin role only
router.use(authenticateToken, authorizeRoles('superadmin'));

// Super Admin Overview Metrics
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await db.query(
      `SELECT 
         COUNT(DISTINCT t.id) as total_tenants,
         COUNT(DISTINCT t.id) FILTER (WHERE t.is_active = TRUE) as active_tenants,
         COUNT(DISTINCT u.id) as total_users,
         COUNT(DISTINCT l.id) as total_leads,
         COALESCE(SUM(p.price_monthly) FILTER (WHERE s.status = 'active'), 0) as mrr
       FROM tenants t
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       LEFT JOIN plans p ON s.plan_id = p.id
       LEFT JOIN users u ON u.tenant_id = t.id
       LEFT JOIN leads l ON l.tenant_id = t.id`
    );

    const planDistribution = await db.query(
      `SELECT p.name as plan_name, p.code, COUNT(s.id) as subscriber_count
       FROM plans p
       LEFT JOIN subscriptions s ON s.plan_id = p.id AND s.status = 'active'
       GROUP BY p.id, p.name, p.code`
    );

    res.json({
      success: true,
      metrics: stats.rows[0],
      planDistribution: planDistribution.rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List All Companies (Tenants)
router.get('/tenants', async (req, res) => {
  const { search, status } = req.query;
  try {
    let query = `SELECT t.*, p.name as plan_name, p.code as plan_code, s.status as subscription_status, s.expires_at,
                        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as user_count,
                        (SELECT COUNT(*) FROM leads l WHERE l.tenant_id = t.id) as lead_count
                 FROM tenants t
                 LEFT JOIN subscriptions s ON s.tenant_id = t.id
                 LEFT JOIN plans p ON s.plan_id = p.id
                 WHERE 1=1`;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (t.company_name ILIKE $${params.length} OR t.email ILIKE $${params.length})`;
    }

    if (status) {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }

    query += ` ORDER BY t.created_at DESC`;
    const result = await db.query(query, params);
    res.json({ success: true, tenants: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Plan Limits & Pricing
router.put('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price_monthly, price_yearly, limits_json, features_json } = req.body;

  try {
    const updateRes = await db.query(
      `UPDATE plans 
       SET name = COALESCE($1, name),
           price_monthly = COALESCE($2, price_monthly),
           price_yearly = COALESCE($3, price_yearly),
           limits_json = COALESCE($4, limits_json),
           features_json = COALESCE($5, features_json)
       WHERE id = $6
       RETURNING *`,
      [name, price_monthly, price_yearly, limits_json, features_json, id]
    );

    res.json({ success: true, plan: updateRes.rows[0], message: 'Plan updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
