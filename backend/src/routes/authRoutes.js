const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'loomlead_super_secret_jwt_key_2026_xyz!@#';

/**
 * Login User & Tenant
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const userRes = await db.query(
      `SELECT u.id, u.tenant_id, u.name, u.email, u.password_hash, u.role, u.status,
              t.company_name, t.slug, t.industry, t.currency, t.labels_config,
              p.code as plan_code, p.name as plan_name, s.status as subscription_status, s.expires_at
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE u.email = $1`,
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact support.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update last login
    await db.query(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

    const token = jwt.sign(
      {
        id: user.id,
        tenant_id: user.tenant_id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenant_id,
        company: user.company_name,
        industry: user.industry,
        currency: user.currency,
        plan: user.plan_code || 'free',
        plan_name: user.plan_name || 'Free Plan',
        subscription_status: user.subscription_status || 'active',
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server login error.' });
  }
});

/**
 * Register New Tenant & Admin User (Starts on Free Plan)
 */
router.post('/register', async (req, res) => {
  const { company_name, name, email, phone, password, industry = 'General Sales' } = req.body;

  if (!company_name || !name || !email || !password) {
    return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if email already registered
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered. Please login.' });
    }

    // 1. Create Tenant
    const slug = company_name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(100 + Math.random() * 900);
    const tenantRes = await client.query(
      `INSERT INTO tenants (company_name, slug, industry, email, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [company_name, slug, industry, email, phone || null]
    );
    const tenant = tenantRes.rows[0];

    // 2. Assign Free Plan by default
    const planRes = await client.query(`SELECT id FROM plans WHERE code = 'free' LIMIT 1`);
    const planId = planRes.rows[0]?.id || 1;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day initial cycle

    await client.query(
      `INSERT INTO subscriptions (tenant_id, plan_id, status, billing_cycle, starts_at, expires_at)
       VALUES ($1, $2, 'active', 'monthly', CURRENT_TIMESTAMP, $3)`,
      [tenant.id, planId, expiresAt]
    );

    // 3. Create Admin User
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userRes = await client.query(
      `INSERT INTO users (tenant_id, name, email, password_hash, phone, role, status)
       VALUES ($1, $2, $3, $4, $5, 'admin', 'active')
       RETURNING id, name, email, role`,
      [tenant.id, name, email, passwordHash, phone || null]
    );
    const user = userRes.rows[0];

    // 4. Create Default Pipeline Stages
    await client.query(
      `INSERT INTO pipeline_stages (tenant_id, name, order_index, color_hex, is_won, is_lost)
       VALUES 
       ($1, 'New', 1, '#3b82f6', FALSE, FALSE),
       ($1, 'Contacted', 2, '#6366f1', FALSE, FALSE),
       ($1, 'Qualified', 3, '#eab308', FALSE, FALSE),
       ($1, 'Proposal Sent', 4, '#8b5cf6', FALSE, FALSE),
       ($1, 'Won', 5, '#10b981', TRUE, FALSE),
       ($1, 'Lost', 6, '#ef4444', FALSE, TRUE)`,
      [tenant.id]
    );

    await client.query('COMMIT');

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, tenant_id: tenant.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully on Free Plan!',
      token,
      user,
      tenant,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  } finally {
    client.release();
  }
});

/**
 * Get Current User Profile & Company
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.avatar_url,
              t.company_name, t.slug, t.industry, t.currency, t.labels_config,
              p.code as plan_code, p.name as plan_name, s.status as subscription_status, s.expires_at
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       LEFT JOIN subscriptions s ON s.tenant_id = t.id
       LEFT JOIN plans p ON s.plan_id = p.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, profile: userRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
