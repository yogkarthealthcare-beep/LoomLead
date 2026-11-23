const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/db');

class WebhookService {
  constructor() {
    this.supportedEvents = [
      'lead.created',
      'lead.stage_changed',
      'lead.won',
      'email.replied',
      'whatsapp.replied'
    ];
  }

  /**
   * Subscribe a new webhook endpoint URL for a tenant
   */
  async subscribe(tenantId, url, events = [], description = '', secret = null) {
    if (!tenantId || !url) {
      throw new Error('Tenant ID and Webhook URL are required.');
    }

    try {
      new URL(url);
    } catch {
      throw new Error('Invalid Webhook URL. Must be a valid HTTP/HTTPS endpoint.');
    }

    // Default to all supported events if none specified
    const sanitizedEvents = (events && events.length > 0)
      ? events.filter(e => this.supportedEvents.includes(e))
      : this.supportedEvents;

    if (sanitizedEvents.length === 0) {
      throw new Error(`Events must be one or more of: ${this.supportedEvents.join(', ')}`);
    }

    // Generate secure signing secret if not supplied
    const signingSecret = secret || `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const query = `
      INSERT INTO webhook_subscriptions (tenant_id, url, events, secret, description)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, tenant_id, url, events, secret, is_active, description, created_at
    `;

    const res = await db.query(query, [
      tenantId,
      url.trim(),
      sanitizedEvents,
      signingSecret,
      description ? description.trim() : null
    ]);

    return res.rows[0];
  }

  /**
   * List subscriptions for a tenant
   */
  async listSubscriptions(tenantId) {
    const res = await db.query(
      `SELECT id, url, events, secret, is_active, description, created_at, updated_at
       FROM webhook_subscriptions
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.rows;
  }

  /**
   * Delete subscription
   */
  async deleteSubscription(tenantId, subscriptionId) {
    const res = await db.query(
      `DELETE FROM webhook_subscriptions WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [subscriptionId, tenantId]
    );
    if (res.rows.length === 0) {
      throw new Error('Webhook subscription not found.');
    }
    return res.rows[0];
  }

  /**
   * Toggle subscription active status
   */
  async toggleSubscription(tenantId, subscriptionId, isActive) {
    const res = await db.query(
      `UPDATE webhook_subscriptions SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [isActive, subscriptionId, tenantId]
    );
    if (res.rows.length === 0) {
      throw new Error('Webhook subscription not found.');
    }
    return res.rows[0];
  }

  /**
   * Dispatch an event to all subscribed webhooks for a tenant
   * Asynchronous, non-blocking
   */
  async dispatch(tenantId, event, data) {
    if (!tenantId || !event) return;

    try {
      const subsRes = await db.query(
        `SELECT id, url, secret, events 
         FROM webhook_subscriptions 
         WHERE tenant_id = $1 AND is_active = TRUE AND $2 = ANY(events)`,
        [tenantId, event]
      );

      if (subsRes.rows.length === 0) {
        return; // No active subscribers for this event
      }

      const payload = {
        event,
        timestamp: new Date().toISOString(),
        tenant_id: tenantId,
        data
      };

      for (const sub of subsRes.rows) {
        // Create delivery log record
        const deliveryRes = await db.query(
          `INSERT INTO webhook_deliveries (tenant_id, webhook_id, event, payload, status, attempt)
           VALUES ($1, $2, $3, $4, 'pending', 1)
           RETURNING *`,
          [tenantId, sub.id, event, JSON.stringify(payload)]
        );

        const delivery = deliveryRes.rows[0];

        // Deliver asynchronously
        setImmediate(() => {
          this.executeDelivery(delivery, sub).catch(err => {
            console.error(`[WebhookService] Delivery error [${delivery.id}]:`, err.message);
          });
        });
      }
    } catch (err) {
      console.error('[WebhookService] Event dispatch failed:', err.message);
    }
  }

  /**
   * Execute delivery with HMAC-SHA256 signature and retry logic
   */
  async executeDelivery(delivery, subscription) {
    const payloadString = typeof delivery.payload === 'string'
      ? delivery.payload
      : JSON.stringify(delivery.payload);

    // Compute HMAC-SHA256 signature
    const signature = crypto
      .createHmac('sha256', subscription.secret)
      .update(payloadString)
      .digest('hex');

    try {
      const response = await axios.post(subscription.url, payloadString, {
        headers: {
          'Content-Type': 'application/json',
          'X-LoomLead-Event': delivery.event,
          'X-LoomLead-Delivery': delivery.id,
          'X-LoomLead-Signature': `sha256=${signature}`,
          'User-Agent': 'LoomLead-Webhooks/1.0'
        },
        timeout: 5000,
        validateStatus: () => true // Handle status codes manually
      });

      const statusCode = response.status;
      const isSuccess = statusCode >= 200 && statusCode < 300;
      const responseBody = typeof response.data === 'string'
        ? response.data.substring(0, 500)
        : JSON.stringify(response.data).substring(0, 500);

      if (isSuccess) {
        await db.query(
          `UPDATE webhook_deliveries
           SET status = 'success',
               status_code = $1,
               response_body = $2,
               error_message = NULL,
               delivered_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [statusCode, responseBody, delivery.id]
        );
      } else {
        await this.handleFailedAttempt(delivery, statusCode, `HTTP status ${statusCode}`, responseBody);
      }
    } catch (err) {
      await this.handleFailedAttempt(delivery, null, err.message, null);
    }
  }

  /**
   * Handle failed delivery attempt with exponential backoff (up to 5 attempts)
   */
  async handleFailedAttempt(delivery, statusCode, errorMessage, responseBody) {
    const nextAttempt = (delivery.attempt || 1) + 1;
    const maxAttempts = delivery.max_attempts || 5;

    if (nextAttempt <= maxAttempts) {
      // Exponential backoff: 2m, 4m, 8m, 16m
      const backoffMinutes = Math.pow(2, delivery.attempt || 1);
      const nextRetryAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

      await db.query(
        `UPDATE webhook_deliveries
         SET status = 'pending',
             status_code = $1,
             error_message = $2,
             response_body = $3,
             attempt = $4,
             next_retry_at = $5
         WHERE id = $6`,
        [statusCode, errorMessage, responseBody, nextAttempt, nextRetryAt, delivery.id]
      );
    } else {
      // Max attempts reached: mark as failed
      await db.query(
        `UPDATE webhook_deliveries
         SET status = 'failed',
             status_code = $1,
             error_message = $2,
             response_body = $3,
             attempt = $4,
             next_retry_at = NULL
         WHERE id = $5`,
        [statusCode, errorMessage, responseBody, nextAttempt - 1, delivery.id]
      );
    }
  }

  /**
   * Manually resend a delivery
   */
  async resendDelivery(tenantId, deliveryId) {
    const deliveryRes = await db.query(
      `SELECT d.*, s.url, s.secret
       FROM webhook_deliveries d
       JOIN webhook_subscriptions s ON d.webhook_id = s.id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [deliveryId, tenantId]
    );

    if (deliveryRes.rows.length === 0) {
      throw new Error('Webhook delivery record not found.');
    }

    const delivery = deliveryRes.rows[0];
    const subscription = { url: delivery.url, secret: delivery.secret };

    await this.executeDelivery(delivery, subscription);

    const updatedRes = await db.query(
      `SELECT * FROM webhook_deliveries WHERE id = $1`,
      [deliveryId]
    );
    return updatedRes.rows[0];
  }

  /**
   * List delivery audit logs
   */
  async listDeliveries(tenantId, options = {}) {
    const limit = Math.min(100, parseInt(options.limit, 10) || 50);
    const offset = Math.max(0, parseInt(options.offset, 10) || 0);

    let query = `
      SELECT d.id, d.webhook_id, d.event, d.status, d.status_code, d.attempt, d.max_attempts, 
             d.next_retry_at, d.error_message, d.created_at, d.delivered_at, d.payload, d.response_body,
             s.url AS webhook_url, s.description AS webhook_description
      FROM webhook_deliveries d
      LEFT JOIN webhook_subscriptions s ON d.webhook_id = s.id
      WHERE d.tenant_id = $1
    `;
    const params = [tenantId];

    if (options.status && options.status !== 'All') {
      params.push(options.status);
      query += ` AND d.status = $${params.length}`;
    }

    if (options.event && options.event !== 'All') {
      params.push(options.event);
      query += ` AND d.event = $${params.length}`;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const res = await db.query(query, params);

    const countRes = await db.query(
      `SELECT COUNT(*) FROM webhook_deliveries WHERE tenant_id = $1`,
      [tenantId]
    );

    return {
      total: parseInt(countRes.rows[0].count, 10),
      deliveries: res.rows
    };
  }

  /**
   * Background retry worker: redeliver pending webhooks whose retry timestamp has arrived
   */
  async processPendingRetries() {
    try {
      const pendingRes = await db.query(
        `SELECT d.*, s.url, s.secret
         FROM webhook_deliveries d
         JOIN webhook_subscriptions s ON d.webhook_id = s.id
         WHERE d.status = 'pending' AND d.next_retry_at <= CURRENT_TIMESTAMP
         LIMIT 20`
      );

      for (const row of pendingRes.rows) {
        const subscription = { url: row.url, secret: row.secret };
        await this.executeDelivery(row, subscription);
      }
    } catch (err) {
      console.error('[WebhookService] Retry worker error:', err.message);
    }
  }
}

module.exports = new WebhookService();
