const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const scoringService = require('../services/scoringService');
const scoringQueue = require('../services/scoringQueue');

// =========================================================================
// 1. SCORING CONFIGURATION (PER TENANT)
// =========================================================================

// Get tenant scoring config
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const config = await scoringService.getScoringConfig(req.tenantId);
    res.json({ success: true, config });
  } catch (err) {
    console.error('Error fetching scoring config:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update tenant scoring config
router.put('/config', authenticateToken, async (req, res) => {
  const { weights, rules, thresholds } = req.body;
  if (!weights) {
    return res.status(400).json({ success: false, message: 'Scoring weights are required.' });
  }

  try {
    const current = await scoringService.getScoringConfig(req.tenantId);
    const updatedConfig = {
      weights: { ...current.weights, ...weights },
      rules: { ...current.rules, ...(rules || {}) },
      thresholds: { ...current.thresholds, ...(thresholds || {}) }
    };

    const saved = await scoringService.updateScoringConfig(req.tenantId, updatedConfig);
    res.json({ success: true, config: saved, message: 'Scoring configuration updated successfully.' });
  } catch (err) {
    console.error('Error updating scoring config:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset config to defaults
router.post('/config/reset', authenticateToken, async (req, res) => {
  try {
    const defaultConfig = scoringService.getDefaultConfig();
    const saved = await scoringService.updateScoringConfig(req.tenantId, defaultConfig);
    res.json({ success: true, config: saved, message: 'Scoring config reset to system defaults.' });
  } catch (err) {
    console.error('Error resetting config:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 2. RECALCULATE ALL LEADS (BACKGROUND QUEUE)
// =========================================================================

router.post('/recalculate', authenticateToken, async (req, res) => {
  try {
    const result = await scoringService.recalculateAllLeads(req.tenantId);
    res.json({
      success: true,
      message: `Enqueued ${result.total_queued} lead(s) for background score recalculation.`,
      total_queued: result.total_queued
    });
  } catch (err) {
    console.error('Error enqueuing lead recalculation:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Queue status
router.get('/queue-status', authenticateToken, async (req, res) => {
  res.json({
    success: true,
    stats: scoringQueue.getStats()
  });
});

// =========================================================================
// 3. SCORE BREAKDOWN ("WHY THIS SCORE?")
// =========================================================================

router.get('/leads/:leadId/breakdown', authenticateToken, async (req, res) => {
  try {
    const leadRes = await db.query(
      `SELECT id, name, company_name, phone, email, website, category, 
              google_rating, review_count, score, score_value, score_breakdown,
              email_opens, email_clicks, whatsapp_replies, last_seen_at
       FROM leads 
       WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [req.params.leadId, req.tenantId]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const lead = leadRes.rows[0];

    // If breakdown not yet generated or needs refresh, evaluate fresh
    let breakdown = lead.score_breakdown;
    if (!breakdown || !breakdown.factors || breakdown.factors.length === 0) {
      const config = await scoringService.getScoringConfig(req.tenantId);
      const evalResult = scoringService.evaluateLead(lead, config);
      breakdown = evalResult.score_breakdown;

      // Update lead
      await db.query(
        `UPDATE leads SET score_value = $1, score = $2, score_breakdown = $3 WHERE id = $4`,
        [evalResult.score_value, evalResult.score, JSON.stringify(breakdown), lead.id]
      );
    }

    res.json({
      success: true,
      lead_id: lead.id,
      lead_name: lead.name,
      company: lead.company_name,
      score_value: lead.score_value,
      bucket: lead.score,
      breakdown
    });
  } catch (err) {
    console.error('Error fetching score breakdown:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 4. ENGAGEMENT EVENT HOOKS
// =========================================================================

// Manual/Webhook engagement trigger
router.post('/events/engagement', authenticateToken, async (req, res) => {
  const { lead_id, type } = req.body;
  if (!lead_id || !type) {
    return res.status(400).json({ success: false, message: 'Lead ID and event type are required.' });
  }

  try {
    const result = await scoringService.recordEngagementEvent(req.tenantId, lead_id, type);
    res.json({ success: true, message: `Engagement event "${type}" recorded and lead queued for rescoring.`, result });
  } catch (err) {
    console.error('Engagement record error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Email open tracking pixel (1x1 transparent GIF)
router.get('/events/track-open/:tenantId/:leadId', async (req, res) => {
  const { tenantId, leadId } = req.params;
  try {
    await db.query(
      `UPDATE leads 
       SET email_opens = email_opens + 1, last_seen_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );
    scoringQueue.enqueue(tenantId, leadId);
  } catch (err) {
    console.error('Track open error:', err.message);
  }

  // Return transparent 1x1 GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': pixel.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private'
  });
  res.end(pixel);
});

// Email link click redirect tracker
router.get('/events/track-click', async (req, res) => {
  const { tenantId, leadId, url } = req.query;
  const targetUrl = url || 'https://loomlead-ec191.web.app';

  try {
    if (tenantId && leadId) {
      await db.query(
        `UPDATE leads 
         SET email_clicks = email_clicks + 1, last_seen_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND tenant_id = $2`,
        [leadId, tenantId]
      );
      scoringQueue.enqueue(tenantId, leadId);
    }
  } catch (err) {
    console.error('Track click error:', err.message);
  }

  res.redirect(targetUrl);
});

module.exports = router;
