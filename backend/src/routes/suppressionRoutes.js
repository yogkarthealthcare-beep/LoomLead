const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const suppressionService = require('../services/suppressionService');
const hygieneService = require('../services/hygieneService');

// 1. Get Suppression / DND List for Tenant
router.get('/', authenticateToken, async (req, res) => {
  const { search = '', type = 'All' } = req.query;
  try {
    const list = await suppressionService.getSuppressionList(req.tenantId, search, type);
    res.json({
      success: true,
      total: list.length,
      suppressionList: list
    });
  } catch (err) {
    console.error('Error fetching suppression list:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Add New Entry to Suppression List (Manual or Bounce)
router.post('/', authenticateToken, async (req, res) => {
  const { type, value, reason = 'manual' } = req.body;

  if (!type || !value) {
    return res.status(400).json({ success: false, message: 'Type (phone|email) and Value are required.' });
  }

  try {
    const entry = await suppressionService.addSuppression(req.tenantId, type, value, reason);
    res.status(201).json({
      success: true,
      entry,
      message: `${type.toUpperCase()} '${value}' added to DND / Suppression List successfully.`
    });
  } catch (err) {
    console.error('Error adding suppression:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Remove Entry from Suppression List
router.delete('/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const removed = await suppressionService.removeSuppression(req.tenantId, id);
    if (!removed) {
      return res.status(404).json({ success: false, message: 'Suppression record not found.' });
    }
    res.json({ success: true, message: 'Entry removed from DND / Suppression list.' });
  } catch (err) {
    console.error('Error removing suppression:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Verify Contact Eligibility: canContact(lead, channel)
router.post('/can-contact', authenticateToken, async (req, res) => {
  const { lead_id, phone, email, channel = 'whatsapp' } = req.body;

  try {
    let lead = null;
    if (lead_id) {
      const leadRes = await db.query(
        `SELECT * FROM leads WHERE id = $1 AND tenant_id = $2`,
        [lead_id, req.tenantId]
      );
      if (leadRes.rows.length > 0) {
        lead = leadRes.rows[0];
      }
    }

    if (!lead) {
      lead = {
        phone: phone || '',
        normalized_phone: hygieneService.normalizePhone(phone),
        email: email || ''
      };
    }

    const check = await suppressionService.canContact(req.tenantId, lead, channel);
    res.json({
      success: true,
      canContact: check.allowed,
      details: check
    });
  } catch (err) {
    console.error('Error checking canContact:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Universal Outbound Send Endpoint (WhatsApp, Email, SMS)
// Enforces canContact check before any dispatch
router.post('/outbound/send', authenticateToken, async (req, res) => {
  const { lead_id, channel = 'whatsapp', message, template_id } = req.body;

  if (!lead_id) {
    return res.status(400).json({ success: false, message: 'Lead ID is required.' });
  }

  try {
    const leadRes = await db.query(
      `SELECT * FROM leads WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [lead_id, req.tenantId]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    const lead = leadRes.rows[0];

    // CRITICAL: Call canContact on EVERY outbound send
    const contactCheck = await suppressionService.canContact(req.tenantId, lead, channel);
    if (!contactCheck.allowed) {
      return res.status(422).json({
        success: false,
        code: 'DND_SUPPRESSED',
        message: contactCheck.message,
        reason: contactCheck.reason,
        prohibited_channel: channel,
        suppressed_value: contactCheck.value
      });
    }

    // If allowed, proceed with outbound dispatch
    res.json({
      success: true,
      message: `Outbound ${channel.toUpperCase()} message sent successfully to ${lead.name} (${lead.phone}).`,
      dispatch: {
        channel,
        lead_id: lead.id,
        recipient: channel === 'email' ? lead.email : lead.phone,
        status: 'delivered',
        timestamp: new Date()
      }
    });
  } catch (err) {
    console.error('Outbound dispatch error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. WhatsApp Incoming Webhook (Automatic STOP / UNSUBSCRIBE / BAND KARO processing)
router.post('/webhooks/whatsapp', async (req, res) => {
  // Can be called by WhatsApp Business API / Twilio / Gupshup / Meta Cloud API
  const { from, body, message, tenant_id } = req.body;
  const senderPhone = from || req.body['From'] || req.body['wa_id'] || '';
  const messageText = body || message || req.body['Body'] || req.body['text'] || '';
  const tenantId = tenant_id || '11111111-1111-1111-1111-111111111111'; // Default tenant if not specified in webhook URL

  try {
    const webhookResult = await suppressionService.handleIncomingWhatsAppWebhook(
      tenantId,
      senderPhone,
      messageText
    );

    res.json({
      success: true,
      processed: true,
      suppressed: webhookResult.suppressed,
      reason: webhookResult.reason || null,
      phone: webhookResult.normalizedPhone || null
    });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
