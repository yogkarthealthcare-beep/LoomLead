const cron = require('node-cron');
const db = require('../config/db');
const sequenceService = require('./sequenceService');
const suppressionService = require('./suppressionService');

class SequenceWorker {
  constructor() {
    this.isRunning = false;
    this.cronTask = null;
  }

  /**
   * Start the background sequence worker (runs every minute)
   */
  start() {
    console.log('🤖 Starting LoomLead Sequence Drip Engine Background Worker (Cron: * * * * *)...');
    
    // Run every minute
    this.cronTask = cron.schedule('* * * * *', async () => {
      await this.processPendingEnrollments();
    });

    // Run once on startup after 5 seconds
    setTimeout(() => {
      this.processPendingEnrollments().catch(err => console.error('Initial sequence worker run error:', err.message));
    }, 5000);
  }

  /**
   * Main processing loop: picks due enrollments and executes next sequence step
   */
  async processPendingEnrollments() {
    if (this.isRunning) {
      return { skipped: true, reason: 'already_running' };
    }
    this.isRunning = true;

    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      completed: 0,
      stoppedDnd: 0,
      delayedWindow: 0,
      delayedLimit: 0
    };

    try {
      // 1. Fetch pending enrollments where next_run_at <= NOW()
      const query = `
        SELECT e.*, s.name as seq_name, s.daily_limit, s.send_window_start, s.send_window_end, 
               s.timezone, s.status as seq_status
        FROM enrollments e
        JOIN sequences s ON e.sequence_id = s.id
        WHERE e.status = 'active'
          AND s.status = 'active'
          AND e.next_run_at <= CURRENT_TIMESTAMP
        ORDER BY e.next_run_at ASC
        LIMIT 50
      `;

      const enrollRes = await db.query(query);
      const enrollments = enrollRes.rows;

      if (enrollments.length === 0) {
        this.isRunning = false;
        return results;
      }

      console.log(`⏱️ Sequence Worker: Found ${enrollments.length} due enrollment(s) to process.`);

      for (const enroll of enrollments) {
        results.processed++;
        try {
          await this.executeEnrollmentStep(enroll, results);
        } catch (err) {
          console.error(`Error processing enrollment [${enroll.id}]:`, err.message);
          results.failed++;
          await this.handleStepFailure(enroll, err.message);
        }
      }

    } catch (err) {
      console.error('Fatal Sequence Worker error:', err.message);
    } finally {
      this.isRunning = false;
    }

    return results;
  }

  /**
   * Process a single enrollment step
   */
  async executeEnrollmentStep(enroll, results) {
    // 1. Send Window Verification (e.g. 09:00 - 18:00 in sequence timezone)
    if (!this.isWithinSendWindow(enroll.send_window_start, enroll.send_window_end, enroll.timezone)) {
      // Postpone next_run_at to tomorrow's window start
      const nextWindowStart = this.getNextWindowStartTime(enroll.send_window_start, enroll.timezone);
      await db.query(`UPDATE enrollments SET next_run_at = $1 WHERE id = $2`, [nextWindowStart, enroll.id]);
      results.delayedWindow++;
      return;
    }

    // 2. Sequence Daily Cap Check
    const dailyCountRes = await db.query(
      `SELECT COUNT(*) FROM message_log m
       JOIN enrollments en ON m.enrollment_id = en.id
       WHERE en.sequence_id = $1 AND DATE(m.sent_at) = CURRENT_DATE AND m.status = 'sent'`,
      [enroll.sequence_id]
    );
    const sentToday = parseInt(dailyCountRes.rows[0].count, 10);

    if (sentToday >= enroll.daily_limit) {
      // Delay to next day
      const tomorrow = new Date(Date.now() + 86400000);
      tomorrow.setHours(9, 0, 0, 0);
      await db.query(`UPDATE enrollments SET next_run_at = $1 WHERE id = $2`, [tomorrow, enroll.id]);
      results.delayedLimit++;
      return;
    }

    // 3. Fetch Step Details
    const stepRes = await db.query(
      `SELECT * FROM sequence_steps WHERE sequence_id = $1 AND step_order = $2`,
      [enroll.sequence_id, enroll.current_step]
    );

    if (stepRes.rows.length === 0) {
      // No more steps -> Mark Completed
      await db.query(
        `UPDATE enrollments SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [enroll.id]
      );
      results.completed++;
      return;
    }
    const currentStep = stepRes.rows[0];

    // 4. Fetch Lead
    const leadRes = await db.query(
      `SELECT * FROM leads WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [enroll.lead_id, enroll.tenant_id]
    );
    if (leadRes.rows.length === 0) {
      await db.query(`UPDATE enrollments SET status = 'stopped', last_error = 'Lead deleted or missing' WHERE id = $1`, [enroll.id]);
      return;
    }
    const lead = leadRes.rows[0];

    // 5. CRITICAL: canContact Check before EVERY Outbound Send
    const contactCheck = await suppressionService.canContact(enroll.tenant_id, lead, currentStep.channel);
    if (!contactCheck.allowed) {
      // Stopped by DND
      await db.query(
        `UPDATE enrollments SET status = 'stopped', last_error = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [contactCheck.message, enroll.id]
      );
      // Log blocked message
      await db.query(
        `INSERT INTO message_log (tenant_id, lead_id, enrollment_id, step_id, channel, recipient, status, error)
         VALUES ($1, $2, $3, $4, $5, $6, 'blocked', $7)`,
        [enroll.tenant_id, lead.id, enroll.id, currentStep.id, currentStep.channel, lead.phone || lead.email, contactCheck.message]
      );
      results.stoppedDnd++;
      return;
    }

    // 6. Select Sender (for Email)
    let senderEmail = null;
    if (currentStep.channel === 'email') {
      const sender = await sequenceService.getNextAvailableSender(enroll.tenant_id);
      senderEmail = sender.email;
    }

    // 7. Render Template Variables
    const renderedSubject = sequenceService.renderTemplate(currentStep.subject || 'Follow-up from LoomLead', lead, enroll.tenant_id);
    let renderedBody = sequenceService.renderTemplate(currentStep.body_content, lead, enroll.tenant_id);

    // Append unsubscribe footer for emails
    if (currentStep.channel === 'email') {
      renderedBody += `\n\n---\nTo unsubscribe from this sequence, click here: {{unsubscribe_link}}`;
      renderedBody = sequenceService.renderTemplate(renderedBody, lead, enroll.tenant_id);
    }

    // 8. Dispatch Outbound Message (Simulated / Integrated Outreach)
    const recipient = currentStep.channel === 'email' ? lead.email : (lead.normalized_phone || lead.phone);
    if (!recipient) {
      throw new Error(`Lead has no ${currentStep.channel} contact information.`);
    }

    const providerMsgId = `${currentStep.channel}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Log to message_log
    await db.query(
      `INSERT INTO message_log 
       (tenant_id, lead_id, enrollment_id, step_id, channel, sender_email, recipient, subject, body_content, status, provider_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent', $10, CURRENT_TIMESTAMP)`,
      [
        enroll.tenant_id,
        lead.id,
        enroll.id,
        currentStep.id,
        currentStep.channel,
        senderEmail,
        recipient,
        renderedSubject,
        renderedBody,
        providerMsgId
      ]
    );

    // Also record in communication_logs for general CRM 360 history
    await db.query(
      `INSERT INTO communication_logs (tenant_id, lead_id, direction, channel, message_content, status)
       VALUES ($1, $2, 'outbound', $3, $4, 'sent')`,
      [enroll.tenant_id, lead.id, currentStep.channel, renderedBody]
    );

    results.sent++;
    console.log(`✉️ Step ${enroll.current_step} (${currentStep.channel}) sent to "${lead.name}" (${recipient})`);

    // 9. Schedule Next Step OR Complete Sequence
    const nextStepOrder = enroll.current_step + 1;
    const nextStepRes = await db.query(
      `SELECT * FROM sequence_steps WHERE sequence_id = $1 AND step_order = $2`,
      [enroll.sequence_id, nextStepOrder]
    );

    if (nextStepRes.rows.length > 0) {
      const nextStep = nextStepRes.rows[0];
      let nextRunAt = new Date();

      if (nextStep.minute_offset !== null && nextStep.minute_offset !== undefined) {
        // Shortened interval for fast testing
        nextRunAt = new Date(Date.now() + nextStep.minute_offset * 60000);
      } else {
        // Day offset relative to sequence schedule
        const dayDifference = Math.max(1, nextStep.day_offset - currentStep.day_offset);
        nextRunAt = new Date(Date.now() + dayDifference * 86400000);
      }

      await db.query(
        `UPDATE enrollments 
         SET current_step = $1, next_run_at = $2, retry_count = 0, last_error = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [nextStepOrder, nextRunAt, enroll.id]
      );
    } else {
      // Sequence completed!
      await db.query(
        `UPDATE enrollments 
         SET status = 'completed', completed_at = CURRENT_TIMESTAMP, retry_count = 0, last_error = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [enroll.id]
      );
      results.completed++;
      console.log(`🏁 Sequence completed for lead "${lead.name}" [Enrollment: ${enroll.id}]`);
    }
  }

  /**
   * Failure handling with exponential retry backoff (3 attempts maximum)
   */
  async handleStepFailure(enroll, errorMessage) {
    const newRetryCount = (enroll.retry_count || 0) + 1;

    if (newRetryCount >= 3) {
      // Mark as permanently failed after 3 attempts
      await db.query(
        `UPDATE enrollments 
         SET status = 'failed', retry_count = $1, last_error = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [newRetryCount, errorMessage, enroll.id]
      );
      console.error(`❌ Enrollment [${enroll.id}] marked as FAILED after 3 attempts. Error: ${errorMessage}`);
    } else {
      // Exponential backoff: 2 min, 4 min
      const backoffMinutes = Math.pow(2, newRetryCount);
      const nextAttempt = new Date(Date.now() + backoffMinutes * 60000);

      await db.query(
        `UPDATE enrollments 
         SET retry_count = $1, next_run_at = $2, last_error = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [newRetryCount, nextAttempt, errorMessage, enroll.id]
      );
      console.warn(`⚠️ Enrollment [${enroll.id}] failed (attempt ${newRetryCount}/3). Retrying in ${backoffMinutes} min.`);
    }

    // Record failure in message_log
    await db.query(
      `INSERT INTO message_log (tenant_id, lead_id, enrollment_id, channel, recipient, status, error)
       VALUES ($1, $2, $3, 'unknown', 'unknown', 'failed', $4)`,
      [enroll.tenant_id, enroll.lead_id, enroll.id, `Attempt ${newRetryCount}/3 failed: ${errorMessage}`]
    );
  }

  /**
   * Helper: Check if current time is within send window (e.g. 09:00 - 18:00)
   */
  isWithinSendWindow(startTime = '09:00', endTime = '18:00', timezone = 'Asia/Kolkata') {
    try {
      const now = new Date();
      // Format current time in tenant timezone
      const timeStr = now.toLocaleTimeString('en-GB', { timeZone: timezone, hour12: false });
      const [currH, currM] = timeStr.split(':').map(Number);
      const currentMinutes = currH * 60 + currM;

      const [startH, startM] = startTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;

      const [endH, endM] = endTime.split(':').map(Number);
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      } else {
        // Crosses midnight
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      }
    } catch {
      return true; // Default to allow if timezone parsing fails
    }
  }

  /**
   * Helper: Compute next window start time
   */
  getNextWindowStartTime(startTime = '09:00', timezone = 'Asia/Kolkata') {
    const next = new Date();
    const [h, m] = startTime.split(':').map(Number);
    next.setDate(next.getDate() + 1);
    next.setHours(h, m, 0, 0);
    return next;
  }
}

module.exports = new SequenceWorker();
