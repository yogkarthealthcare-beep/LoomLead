const db = require('../config/db');
const suppressionService = require('./suppressionService');
const hygieneService = require('./hygieneService');

class SequenceService {
  // =========================================================================
  // 1. SEQUENCE CRUD
  // =========================================================================

  async createSequence(tenantId, data) {
    const {
      name,
      daily_limit = 100,
      send_window_start = '09:00',
      send_window_end = '18:00',
      timezone = 'Asia/Kolkata',
      status = 'active'
    } = data;

    if (!name || !name.trim()) {
      throw new Error('Sequence name is required.');
    }

    const res = await db.query(
      `INSERT INTO sequences (tenant_id, name, status, daily_limit, send_window_start, send_window_end, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, name.trim(), status, daily_limit, send_window_start, send_window_end, timezone]
    );

    return res.rows[0];
  }

  async getSequences(tenantId) {
    const query = `
      SELECT s.*,
        COUNT(DISTINCT e.id) AS total_enrolled,
        COUNT(DISTINCT CASE WHEN e.status = 'active' THEN e.id END) AS active_enrolled,
        COUNT(DISTINCT CASE WHEN e.status = 'replied' THEN e.id END) AS replied_count,
        COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) AS completed_count,
        COUNT(DISTINCT CASE WHEN m.status = 'sent' THEN m.id END) AS messages_sent,
        COUNT(DISTINCT st.id) AS total_steps
      FROM sequences s
      LEFT JOIN enrollments e ON s.id = e.sequence_id
      LEFT JOIN sequence_steps st ON s.id = st.sequence_id
      LEFT JOIN message_log m ON e.id = m.enrollment_id
      WHERE s.tenant_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `;
    const res = await db.query(query, [tenantId]);
    return res.rows;
  }

  async getSequenceById(tenantId, sequenceId) {
    const seqRes = await db.query(
      `SELECT * FROM sequences WHERE id = $1 AND tenant_id = $2`,
      [sequenceId, tenantId]
    );

    if (seqRes.rows.length === 0) {
      return null;
    }

    const sequence = seqRes.rows[0];

    // Fetch steps ordered
    const stepsRes = await db.query(
      `SELECT * FROM sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC`,
      [sequenceId]
    );
    sequence.steps = stepsRes.rows;

    // Fetch stats
    const statsRes = await db.query(
      `SELECT 
        COUNT(DISTINCT id) AS total_enrolled,
        COUNT(DISTINCT CASE WHEN status = 'active' THEN id END) AS active,
        COUNT(DISTINCT CASE WHEN status = 'paused' THEN id END) AS paused,
        COUNT(DISTINCT CASE WHEN status = 'replied' THEN id END) AS replied,
        COUNT(DISTINCT CASE WHEN status = 'completed' THEN id END) AS completed,
        COUNT(DISTINCT CASE WHEN status = 'failed' THEN id END) AS failed
       FROM enrollments
       WHERE sequence_id = $1 AND tenant_id = $2`,
      [sequenceId, tenantId]
    );
    sequence.stats = statsRes.rows[0];

    return sequence;
  }

  async updateSequence(tenantId, sequenceId, data) {
    const { name, status, daily_limit, send_window_start, send_window_end, timezone } = data;
    const res = await db.query(
      `UPDATE sequences
       SET name = COALESCE($1, name),
           status = COALESCE($2, status),
           daily_limit = COALESCE($3, daily_limit),
           send_window_start = COALESCE($4, send_window_start),
           send_window_end = COALESCE($5, send_window_end),
           timezone = COALESCE($6, timezone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [name, status, daily_limit, send_window_start, send_window_end, timezone, sequenceId, tenantId]
    );
    return res.rows[0] || null;
  }

  async deleteSequence(tenantId, sequenceId) {
    const res = await db.query(
      `DELETE FROM sequences WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [sequenceId, tenantId]
    );
    return res.rows.length > 0;
  }

  // =========================================================================
  // 2. SEQUENCE STEPS MANAGEMENT
  // =========================================================================

  async addStep(sequenceId, stepData) {
    const {
      day_offset = 1,
      minute_offset = null,
      channel = 'email',
      template_id = null,
      subject = '',
      body_content = ''
    } = stepData;

    // Determine next step_order
    const countRes = await db.query(
      `SELECT COALESCE(MAX(step_order), 0) + 1 AS next_order FROM sequence_steps WHERE sequence_id = $1`,
      [sequenceId]
    );
    const step_order = countRes.rows[0].next_order;

    const res = await db.query(
      `INSERT INTO sequence_steps (sequence_id, step_order, day_offset, minute_offset, channel, template_id, subject, body_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [sequenceId, step_order, day_offset, minute_offset, channel, template_id, subject, body_content]
    );

    return res.rows[0];
  }

  async updateStep(sequenceId, stepId, stepData) {
    const { day_offset, minute_offset, channel, subject, body_content } = stepData;
    const res = await db.query(
      `UPDATE sequence_steps
       SET day_offset = COALESCE($1, day_offset),
           minute_offset = $2,
           channel = COALESCE($3, channel),
           subject = COALESCE($4, subject),
           body_content = COALESCE($5, body_content)
       WHERE id = $6 AND sequence_id = $7
       RETURNING *`,
      [day_offset, minute_offset, channel, subject, body_content, stepId, sequenceId]
    );
    return res.rows[0] || null;
  }

  async deleteStep(sequenceId, stepId) {
    const res = await db.query(
      `DELETE FROM sequence_steps WHERE id = $1 AND sequence_id = $2 RETURNING step_order`,
      [stepId, sequenceId]
    );

    if (res.rows.length > 0) {
      // Re-index remaining steps to ensure contiguous 1..N order
      const remaining = await db.query(
        `SELECT id FROM sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC`,
        [sequenceId]
      );
      for (let i = 0; i < remaining.rows.length; i++) {
        await db.query(`UPDATE sequence_steps SET step_order = $1 WHERE id = $2`, [i + 1, remaining.rows[i].id]);
      }
      return true;
    }
    return false;
  }

  // =========================================================================
  // 3. MULTIPLE SENDER EMAIL ROTATION & DAILY CAPS
  // =========================================================================

  async getSenders(tenantId) {
    // Reset sent_today for new calendar day
    await db.query(
      `UPDATE sequence_senders 
       SET sent_today = 0, last_sent_date = CURRENT_DATE 
       WHERE tenant_id = $1 AND last_sent_date < CURRENT_DATE`,
      [tenantId]
    );

    const res = await db.query(
      `SELECT * FROM sequence_senders WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [tenantId]
    );
    return res.rows;
  }

  async addSender(tenantId, data) {
    const { email, display_name = '', daily_cap = 50 } = data;
    if (!email) throw new Error('Sender email is required.');

    const res = await db.query(
      `INSERT INTO sequence_senders (tenant_id, email, display_name, daily_cap, sent_today, is_active)
       VALUES ($1, $2, $3, $4, 0, TRUE)
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET display_name = EXCLUDED.display_name, daily_cap = EXCLUDED.daily_cap, is_active = TRUE
       RETURNING *`,
      [tenantId, email.trim().toLowerCase(), display_name, daily_cap]
    );
    return res.rows[0];
  }

  async deleteSender(tenantId, senderId) {
    const res = await db.query(
      `DELETE FROM sequence_senders WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [senderId, tenantId]
    );
    return res.rows.length > 0;
  }

  /**
   * Selects next active sender adhering to daily caps (Load-balanced round-robin)
   */
  async getNextAvailableSender(tenantId) {
    // 1. Reset sent_today if date changed
    await db.query(
      `UPDATE sequence_senders 
       SET sent_today = 0, last_sent_date = CURRENT_DATE 
       WHERE tenant_id = $1 AND last_sent_date < CURRENT_DATE`,
      [tenantId]
    );

    // 2. Select sender with available capacity having lowest sent_today
    const res = await db.query(
      `SELECT * FROM sequence_senders
       WHERE tenant_id = $1 AND is_active = TRUE AND sent_today < daily_cap
       ORDER BY sent_today ASC, id ASC
       LIMIT 1`,
      [tenantId]
    );

    if (res.rows.length > 0) {
      const sender = res.rows[0];
      // Increment usage count
      await db.query(
        `UPDATE sequence_senders SET sent_today = sent_today + 1 WHERE id = $1`,
        [sender.id]
      );
      return sender;
    }

    // Default fallback if no sender configured or all reached daily cap
    return {
      email: process.env.DEFAULT_SENDER_EMAIL || 'outreach@loomlead.com',
      display_name: 'LoomLead Outreach',
      daily_cap: 9999,
      sent_today: 0
    };
  }

  // =========================================================================
  // 4. LEAD ENROLLMENT (SINGLE & BULK WITH DND CHECK)
  // =========================================================================

  async enrollLead(tenantId, sequenceId, leadId, options = {}) {
    // 1. Verify sequence exists and active
    const seq = await this.getSequenceById(tenantId, sequenceId);
    if (!seq) throw new Error('Sequence not found.');
    if (seq.steps.length === 0) throw new Error('Sequence has no steps configured.');

    // 2. Verify lead exists
    const leadRes = await db.query(
      `SELECT * FROM leads WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [leadId, tenantId]
    );
    if (leadRes.rows.length === 0) throw new Error('Lead not found.');
    const lead = leadRes.rows[0];

    const firstStep = seq.steps[0];

    // 3. DND / SUPPRESSION ENFORCEMENT: Skip lead if suppressed on any channel used in sequence
    for (const step of seq.steps) {
      const contactCheck = await suppressionService.canContact(tenantId, lead, step.channel);
      if (!contactCheck.allowed) {
        return {
          enrolled: false,
          skipped: true,
          reason: 'suppressed_dnd',
          message: contactCheck.message
        };
      }
    }

    // 4. Check if already actively enrolled in this sequence
    const existingEnroll = await db.query(
      `SELECT id, status FROM enrollments 
       WHERE sequence_id = $1 AND lead_id = $2 AND tenant_id = $3 AND status IN ('active', 'paused')`,
      [sequenceId, leadId, tenantId]
    );

    if (existingEnroll.rows.length > 0) {
      return {
        enrolled: false,
        skipped: true,
        reason: 'already_active',
        message: `Lead is already active in sequence "${seq.name}".`
      };
    }

    // 5. Calculate next_run_at for step 1
    let nextRunAt = new Date();
    if (options.immediate) {
      nextRunAt = new Date();
    } else if (firstStep.minute_offset !== null && firstStep.minute_offset !== undefined) {
      nextRunAt = new Date(Date.now() + firstStep.minute_offset * 60000);
    } else if (firstStep.day_offset > 1) {
      nextRunAt = new Date(Date.now() + (firstStep.day_offset - 1) * 86400000);
    }

    // 6. Insert Enrollment
    const enrollRes = await db.query(
      `INSERT INTO enrollments (tenant_id, lead_id, sequence_id, current_step, status, next_run_at)
       VALUES ($1, $2, $3, 1, 'active', $4)
       RETURNING *`,
      [tenantId, leadId, sequenceId, nextRunAt]
    );

    return {
      enrolled: true,
      skipped: false,
      enrollment: enrollRes.rows[0]
    };
  }

  async bulkEnrollLeads(tenantId, sequenceId, leadIds, options = {}) {
    let enrolledCount = 0;
    let skippedCount = 0;
    const details = [];

    for (const leadId of leadIds) {
      try {
        const res = await this.enrollLead(tenantId, sequenceId, leadId, options);
        if (res.enrolled) {
          enrolledCount++;
        } else {
          skippedCount++;
        }
        details.push({ leadId, ...res });
      } catch (err) {
        skippedCount++;
        details.push({ leadId, enrolled: false, skipped: true, error: err.message });
      }
    }

    return {
      total: leadIds.length,
      enrolledCount,
      skippedCount,
      details
    };
  }

  // =========================================================================
  // 5. TEMPLATE RENDERING & PERSONALIZATION (WITH UNSUBSCRIBE LINK)
  // =========================================================================

  renderTemplate(content, lead, tenantId) {
    if (!content) return '';

    const name = lead.name || 'there';
    const firstName = name.split(' ')[0] || name;
    const company = (lead.company_name && lead.company_name !== 'N/A') ? lead.company_name : 'your company';
    const category = lead.category || 'business';
    const city = (lead.city && lead.city !== 'India') ? lead.city : 'your city';

    // Tailored icebreaker
    let icebreaker = `I came across your work in ${category} in ${city} and was impressed by what you are building.`;
    if (lead.notes && lead.notes.length > 5) {
      icebreaker = `I was reviewing your profile regarding ${lead.notes.split('|')[0].trim()}.`;
    }

    // Unsubscribe Link
    const frontendUrl = process.env.FRONTEND_URL || 'https://loomlead-ec191.web.app';
    const unsubscribeUrl = `${frontendUrl}/suppression?action=unsubscribe&tenant=${tenantId}&email=${encodeURIComponent(lead.email || '')}&phone=${encodeURIComponent(lead.phone || '')}`;

    return content
      .replace(/\{\{\s*name\s*\}\}/gi, name)
      .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
      .replace(/\{\{\s*company\s*\}\}/gi, company)
      .replace(/\{\{\s*category\s*\}\}/gi, category)
      .replace(/\{\{\s*city\s*\}\}/gi, city)
      .replace(/\{\{\s*icebreaker\s*\}\}/gi, icebreaker)
      .replace(/\{\{\s*phone\s*\}\}/gi, lead.phone || '')
      .replace(/\{\{\s*email\s*\}\}/gi, lead.email || '')
      .replace(/\{\{\s*unsubscribe_link\s*\}\}/gi, unsubscribeUrl);
  }

  // =========================================================================
  // 6. REPLY DETECTION & AUTO-PAUSE
  // =========================================================================

  async handleLeadReply(tenantId, identifier, channel = 'whatsapp', messageContent = '') {
    // 1. Identify lead by phone or email
    let lead = null;
    const normPhone = hygieneService.normalizePhone(identifier);

    if (normPhone) {
      const pRes = await db.query(
        `SELECT * FROM leads WHERE tenant_id = $1 AND (normalized_phone = $2 OR phone = $3) AND is_deleted = FALSE LIMIT 1`,
        [tenantId, normPhone, identifier]
      );
      if (pRes.rows.length > 0) lead = pRes.rows[0];
    }

    if (!lead && identifier.includes('@')) {
      const eRes = await db.query(
        `SELECT * FROM leads WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) AND is_deleted = FALSE LIMIT 1`,
        [tenantId, identifier.trim()]
      );
      if (eRes.rows.length > 0) lead = eRes.rows[0];
    }

    if (!lead) {
      return { handled: false, reason: 'lead_not_found' };
    }

    // 2. Find active or paused sequence enrollments for this lead
    const enrollRes = await db.query(
      `SELECT * FROM enrollments 
       WHERE tenant_id = $1 AND lead_id = $2 AND status IN ('active', 'paused')`,
      [tenantId, lead.id]
    );

    if (enrollRes.rows.length === 0) {
      return { handled: true, pausedEnrollments: 0, leadId: lead.id, note: 'No active sequence to pause' };
    }

    // 3. Auto-pause remaining steps by setting status to 'replied'
    const enrollmentIds = enrollRes.rows.map(e => e.id);
    await db.query(
      `UPDATE enrollments 
       SET status = 'replied', updated_at = CURRENT_TIMESTAMP 
       WHERE id = ANY($1::uuid[])`,
      [enrollmentIds]
    );

    // 4. Move lead stage to 'Contacted' in CRM pipeline and record engagement
    const engagementCol = channel === 'whatsapp' ? 'whatsapp_replies' : 'email_opens';
    await db.query(
      `UPDATE leads 
       SET status = 'Contacted',
           ${engagementCol} = COALESCE(${engagementCol}, 0) + 1,
           last_seen_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [lead.id]
    );

    const scoringQueue = require('./scoringQueue');
    scoringQueue.enqueue(tenantId, lead.id);

    // 5. Log incoming reply
    await db.query(
      `INSERT INTO communication_logs (tenant_id, lead_id, direction, channel, message_content, status)
       VALUES ($1, $2, 'inbound', $3, $4, 'received')`,
      [tenantId, lead.id, channel, messageContent || 'Inbound reply received. Sequence paused.']
    );

    // 6. Trigger Outgoing Webhook for email.replied or whatsapp.replied
    try {
      const webhookService = require('./webhookService');
      const eventName = channel === 'email' ? 'email.replied' : 'whatsapp.replied';
      webhookService.dispatch(tenantId, eventName, {
        lead_id: lead.id,
        lead_name: lead.name,
        company_name: lead.company_name,
        phone: lead.phone,
        email: lead.email,
        channel,
        message: messageContent,
        paused_enrollments: enrollmentIds
      });
    } catch (whErr) {
      console.error('[SequenceService] Error dispatching webhook on reply:', whErr.message);
    }

    return {
      handled: true,
      pausedEnrollments: enrollmentIds.length,
      leadId: lead.id,
      leadName: lead.name,
      statusSet: 'replied'
    };
  }
}

module.exports = new SequenceService();
