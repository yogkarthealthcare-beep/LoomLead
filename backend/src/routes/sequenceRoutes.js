const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken } = require('../middleware/authMiddleware');
const sequenceService = require('../services/sequenceService');
const sequenceWorker = require('../services/sequenceWorker');
const suppressionService = require('../services/suppressionService');

// =========================================================================
// 1. SEQUENCES CRUD
// =========================================================================

// List all sequences with metrics
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sequences = await sequenceService.getSequences(req.tenantId);
    res.json({ success: true, sequences });
  } catch (err) {
    console.error('Error fetching sequences:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create new sequence
router.post('/', authenticateToken, async (req, res) => {
  try {
    const sequence = await sequenceService.createSequence(req.tenantId, req.body);
    res.status(201).json({ success: true, sequence, message: 'Sequence created successfully.' });
  } catch (err) {
    console.error('Error creating sequence:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get single sequence details with steps and stats
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const sequence = await sequenceService.getSequenceById(req.tenantId, req.params.id);
    if (!sequence) {
      return res.status(404).json({ success: false, message: 'Sequence not found.' });
    }
    res.json({ success: true, sequence });
  } catch (err) {
    console.error('Error fetching sequence:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update sequence
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await sequenceService.updateSequence(req.tenantId, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Sequence not found.' });
    }
    res.json({ success: true, sequence: updated, message: 'Sequence updated successfully.' });
  } catch (err) {
    console.error('Error updating sequence:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete sequence
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await sequenceService.deleteSequence(req.tenantId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Sequence not found.' });
    }
    res.json({ success: true, message: 'Sequence deleted successfully.' });
  } catch (err) {
    console.error('Error deleting sequence:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 2. SEQUENCE STEPS MANAGEMENT
// =========================================================================

// Add step to sequence
router.post('/:id/steps', authenticateToken, async (req, res) => {
  try {
    const step = await sequenceService.addStep(req.params.id, req.body);
    res.status(201).json({ success: true, step, message: 'Step added successfully.' });
  } catch (err) {
    console.error('Error adding step:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Update step
router.put('/:id/steps/:stepId', authenticateToken, async (req, res) => {
  try {
    const updated = await sequenceService.updateStep(req.params.id, req.params.stepId, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Step not found.' });
    }
    res.json({ success: true, step: updated, message: 'Step updated successfully.' });
  } catch (err) {
    console.error('Error updating step:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete step
router.delete('/:id/steps/:stepId', authenticateToken, async (req, res) => {
  try {
    const deleted = await sequenceService.deleteStep(req.params.id, req.params.stepId);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Step not found.' });
    }
    res.json({ success: true, message: 'Step deleted successfully.' });
  } catch (err) {
    console.error('Error deleting step:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 3. SENDER ACCOUNTS (MULTIPLE SENDERS WITH ROTATION)
// =========================================================================

router.get('/senders/list', authenticateToken, async (req, res) => {
  try {
    const senders = await sequenceService.getSenders(req.tenantId);
    res.json({ success: true, senders });
  } catch (err) {
    console.error('Error fetching senders:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/senders', authenticateToken, async (req, res) => {
  try {
    const sender = await sequenceService.addSender(req.tenantId, req.body);
    res.status(201).json({ success: true, sender, message: 'Sender added successfully.' });
  } catch (err) {
    console.error('Error adding sender:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/senders/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await sequenceService.deleteSender(req.tenantId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Sender not found.' });
    }
    res.json({ success: true, message: 'Sender removed successfully.' });
  } catch (err) {
    console.error('Error deleting sender:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 4. LEAD ENROLLMENT (SINGLE & BULK)
// =========================================================================

router.post('/:id/enroll', authenticateToken, async (req, res) => {
  const { lead_id, lead_ids, immediate = false } = req.body;
  const sequenceId = req.params.id;

  try {
    if (Array.isArray(lead_ids) && lead_ids.length > 0) {
      // Bulk enrollment
      const bulkRes = await sequenceService.bulkEnrollLeads(req.tenantId, sequenceId, lead_ids, { immediate });
      return res.json({
        success: true,
        ...bulkRes,
        message: `Enrolled ${bulkRes.enrolledCount} lead(s). (${bulkRes.skippedCount} skipped due to DND or existing active enrollment).`
      });
    }

    if (!lead_id) {
      return res.status(400).json({ success: false, message: 'Lead ID or Lead IDs array is required.' });
    }

    // Single enrollment
    const result = await sequenceService.enrollLead(req.tenantId, sequenceId, lead_id, { immediate });
    if (result.skipped) {
      return res.status(200).json({
        success: false,
        skipped: true,
        reason: result.reason,
        message: result.message
      });
    }

    res.status(201).json({
      success: true,
      enrollment: result.enrollment,
      message: 'Lead enrolled into sequence successfully.'
    });
  } catch (err) {
    console.error('Enrollment error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get enrollments for sequence
router.get('/:id/enrollments', authenticateToken, async (req, res) => {
  const { status, limit = 50, page = 1 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT e.*, l.name as lead_name, l.phone as lead_phone, l.email as lead_email, l.company_name, l.status as lead_stage
      FROM enrollments e
      JOIN leads l ON e.lead_id = l.id
      WHERE e.sequence_id = $1 AND e.tenant_id = $2
    `;
    const params = [req.params.id, req.tenantId];

    if (status) {
      params.push(status);
      query += ` AND e.status = $${params.length}`;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    res.json({ success: true, enrollments: result.rows });
  } catch (err) {
    console.error('Error fetching enrollments:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get message logs for sequence
router.get('/:id/logs', authenticateToken, async (req, res) => {
  try {
    const logsRes = await db.query(
      `SELECT m.*, l.name as lead_name, l.company_name
       FROM message_log m
       JOIN enrollments e ON m.enrollment_id = e.id
       JOIN leads l ON m.lead_id = l.id
       WHERE e.sequence_id = $1 AND m.tenant_id = $2
       ORDER BY m.sent_at DESC
       LIMIT 100`,
      [req.params.id, req.tenantId]
    );
    res.json({ success: true, logs: logsRes.rows });
  } catch (err) {
    console.error('Error fetching message logs:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 5. MANUAL BACKGROUND WORKER TRIGGER (FOR TESTING & IMMEDIATE DISPATCH)
// =========================================================================

router.post('/worker/trigger', authenticateToken, async (req, res) => {
  try {
    const summary = await sequenceWorker.processPendingEnrollments();
    res.json({ success: true, message: 'Sequence worker run complete.', summary });
  } catch (err) {
    console.error('Error triggering sequence worker:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 6. INBOUND REPLY WEBHOOKS (AUTO-PAUSE SEQUENCES)
// =========================================================================

// Email reply webhook
router.post('/webhook/email-reply', async (req, res) => {
  const { from, to, subject, body, tenant_id } = req.body;
  const tenantId = tenant_id || '11111111-1111-1111-1111-111111111111';

  try {
    const result = await sequenceService.handleLeadReply(tenantId, from, 'email', body || subject);
    res.json({ success: true, result });
  } catch (err) {
    console.error('Email reply webhook error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// 7. ONE-CLICK EMAIL UNSUBSCRIBE ENDPOINT
// =========================================================================

router.get('/unsubscribe', async (req, res) => {
  const { tenant, email, phone } = req.query;
  const tenantId = tenant || '11111111-1111-1111-1111-111111111111';

  try {
    if (email) {
      await suppressionService.addSuppression(tenantId, 'email', email, 'unsubscribe');
    }
    if (phone) {
      await suppressionService.addSuppression(tenantId, 'phone', phone, 'unsubscribe');
    }

    // Return friendly HTML confirmation page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed - LoomLead</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body class="bg-light d-flex align-items-center min-vh-100">
        <div class="container text-center py-5">
          <div class="card border-0 shadow-sm mx-auto p-4" style="max-width: 450px;">
            <div class="text-success mb-3">
              <svg width="48" height="48" fill="currentColor" class="bi bi-check-circle-fill" viewBox="0 0 16 16">
                <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
              </svg>
            </div>
            <h4 class="fw-bold mb-2">You Have Been Unsubscribed</h4>
            <p class="text-muted small">
              <strong>${email || phone || 'Your contact'}</strong> has been successfully added to our Do-Not-Disturb (DND) suppression list. You will not receive any further automated outreach from LoomLead.
            </p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Unsubscribe error:', err.message);
    res.status(500).send('An error occurred while processing your unsubscribe request.');
  }
});

module.exports = router;
