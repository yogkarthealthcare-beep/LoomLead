const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const apiKeyService = require('../services/apiKeyService');
const webhookService = require('../services/webhookService');

// All endpoints in this router require JWT authentication
router.use(authenticateToken);

// =========================================================================
// 1. API KEY MANAGEMENT
// =========================================================================

// List tenant's API keys
router.get('/keys', async (req, res) => {
  try {
    const keys = await apiKeyService.listApiKeys(req.tenantId);
    res.json({ success: true, keys });
  } catch (err) {
    console.error('[Integrations] List keys error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new API key (returns raw_key once)
router.post('/keys', async (req, res) => {
  try {
    const { name, scopes, expires_at } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'API Key name is required.' });
    }

    const created = await apiKeyService.createApiKey(
      req.tenantId,
      name,
      scopes || ['leads:read', 'leads:write'],
      expires_at
    );

    res.status(201).json({
      success: true,
      message: 'API Key generated successfully. Save it now, you will not be able to see it again!',
      key: created
    });
  } catch (err) {
    console.error('[Integrations] Create key error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Revoke API key
router.delete('/keys/:id', async (req, res) => {
  try {
    const revoked = await apiKeyService.revokeApiKey(req.tenantId, req.params.id);
    res.json({ success: true, message: 'API Key revoked successfully.', key: revoked });
  } catch (err) {
    console.error('[Integrations] Revoke key error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 2. OUTGOING WEBHOOK SUBSCRIPTIONS
// =========================================================================

// List webhook subscriptions
router.get('/webhooks', async (req, res) => {
  try {
    const subscriptions = await webhookService.listSubscriptions(req.tenantId);
    res.json({
      success: true,
      subscriptions,
      supported_events: webhookService.supportedEvents
    });
  } catch (err) {
    console.error('[Integrations] List webhooks error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create webhook subscription
router.post('/webhooks', async (req, res) => {
  try {
    const { url, events, description } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'Webhook URL is required.' });
    }

    const sub = await webhookService.subscribe(
      req.tenantId,
      url,
      events,
      description
    );

    res.status(201).json({
      success: true,
      message: 'Webhook endpoint subscribed successfully.',
      subscription: sub
    });
  } catch (err) {
    console.error('[Integrations] Create webhook error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Delete webhook subscription
router.delete('/webhooks/:id', async (req, res) => {
  try {
    await webhookService.deleteSubscription(req.tenantId, req.params.id);
    res.json({ success: true, message: 'Webhook subscription deleted successfully.' });
  } catch (err) {
    console.error('[Integrations] Delete webhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Toggle webhook subscription active status
router.patch('/webhooks/:id/toggle', async (req, res) => {
  try {
    const { is_active } = req.body;
    const sub = await webhookService.toggleSubscription(req.tenantId, req.params.id, is_active !== false);
    res.json({ success: true, subscription: sub });
  } catch (err) {
    console.error('[Integrations] Toggle webhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send test event to verify webhook
router.post('/webhooks/test', async (req, res) => {
  try {
    const { event, url } = req.body;
    const testEvent = event || 'lead.created';

    const testPayload = {
      test: true,
      lead: {
        id: 'test-lead-id',
        name: 'Test Prospect from LoomLead',
        company_name: 'Acme Test Corp',
        phone: '+91 98765 43210',
        email: 'test@acmetest.com',
        status: 'New',
        score: 'Hot',
        score_value: 85
      }
    };

    if (url) {
      // Test directly against a given URL
      const sub = { url, secret: 'whsec_test_secret_1234567890' };
      const delivery = {
        id: 'test-delivery-' + Date.now(),
        event: testEvent,
        payload: { event: testEvent, timestamp: new Date().toISOString(), data: testPayload }
      };
      await webhookService.executeDelivery(delivery, sub);
    } else {
      // Dispatch to all configured subscriptions
      await webhookService.dispatch(req.tenantId, testEvent, testPayload);
    }

    res.json({
      success: true,
      message: `Test event "${testEvent}" dispatched to webhooks.`
    });
  } catch (err) {
    console.error('[Integrations] Test webhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 3. WEBHOOK DELIVERY LOGS & RESEND
// =========================================================================

// List delivery logs
router.get('/deliveries', async (req, res) => {
  try {
    const { status, event, limit, offset } = req.query;
    const data = await webhookService.listDeliveries(req.tenantId, {
      status,
      event,
      limit,
      offset
    });
    res.json({ success: true, ...data });
  } catch (err) {
    console.error('[Integrations] List deliveries error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Resend failed or pending delivery
router.post('/deliveries/:id/resend', async (req, res) => {
  try {
    const updated = await webhookService.resendDelivery(req.tenantId, req.params.id);
    res.json({
      success: true,
      message: 'Webhook redelivery triggered.',
      delivery: updated
    });
  } catch (err) {
    console.error('[Integrations] Resend delivery error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
