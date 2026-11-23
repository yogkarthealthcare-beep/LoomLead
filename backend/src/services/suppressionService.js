const db = require('../config/db');
const hygieneService = require('./hygieneService');

/**
 * Enterprise Suppression & DND (Do Not Disturb) Compliance Service
 */
class SuppressionService {
  /**
   * Check if a lead can be contacted via a specific channel
   * Channel: 'whatsapp' | 'sms' | 'call' | 'email'
   * Returns: { allowed: boolean, reason?: string, message?: string }
   */
  async canContact(tenantId, lead, channel = 'whatsapp') {
    if (!tenantId || !lead) {
      return { allowed: true };
    }

    const ch = (channel || 'whatsapp').toLowerCase();
    const checks = [];

    // 1. Phone-based channels: WhatsApp, SMS, Outbound Call
    if (['whatsapp', 'sms', 'call'].includes(ch)) {
      const rawPhone = lead.phone || lead.normalized_phone || '';
      const normPhone = hygieneService.normalizePhone(rawPhone);
      if (normPhone) {
        checks.push({ type: 'phone', value: normPhone });
      }
      if (rawPhone && rawPhone !== normPhone) {
        checks.push({ type: 'phone', value: rawPhone });
      }
    }

    // 2. Email channel
    if (ch === 'email' && lead.email) {
      checks.push({ type: 'email', value: lead.email.trim().toLowerCase() });
    }

    if (checks.length === 0) {
      return { allowed: true };
    }

    // Query suppression_list
    for (const item of checks) {
      const res = await db.query(
        `SELECT id, type, value, reason, created_at 
         FROM suppression_list 
         WHERE tenant_id = $1 AND type = $2 AND value = $3 
         LIMIT 1`,
        [tenantId, item.type, item.value]
      );

      if (res.rows.length > 0) {
        const sup = res.rows[0];
        return {
          allowed: false,
          id: sup.id,
          type: sup.type,
          value: sup.value,
          reason: sup.reason,
          created_at: sup.created_at,
          message: `Contact blocked: Lead (${sup.value}) is on the DND / Suppression List [Reason: ${sup.reason}]. Outbound ${channel.toUpperCase()} is prohibited.`
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Add Phone or Email to Suppression / DND list
   * Types: 'phone' | 'email'
   * Reasons: 'stop_keyword' | 'unsubscribe' | 'manual' | 'bounce'
   */
  async addSuppression(tenantId, type, rawValue, reason = 'manual') {
    if (!tenantId || !type || !rawValue) {
      throw new Error('Tenant ID, type, and value are required for suppression.');
    }

    const t = type.toLowerCase();
    if (!['phone', 'email'].includes(t)) {
      throw new Error("Suppression type must be 'phone' or 'email'.");
    }

    const validReasons = ['stop_keyword', 'unsubscribe', 'manual', 'bounce'];
    const r = validReasons.includes(reason) ? reason : 'manual';

    let normalizedValue = rawValue.trim();
    if (t === 'phone') {
      normalizedValue = hygieneService.normalizePhone(rawValue) || rawValue.trim();
    } else {
      normalizedValue = rawValue.trim().toLowerCase();
    }

    const query = `
      INSERT INTO suppression_list (tenant_id, type, value, reason, created_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, type, value) 
      DO UPDATE SET reason = EXCLUDED.reason, created_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const res = await db.query(query, [tenantId, t, normalizedValue, r]);
    return res.rows[0];
  }

  /**
   * Remove entry from Suppression / DND list
   */
  async removeSuppression(tenantId, id) {
    const res = await db.query(
      `DELETE FROM suppression_list WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [id, tenantId]
    );
    return res.rows.length > 0;
  }

  /**
   * Get all suppression list records for tenant
   */
  async getSuppressionList(tenantId, search = '', type = 'All') {
    let query = `SELECT * FROM suppression_list WHERE tenant_id = $1`;
    const params = [tenantId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND value ILIKE $${params.length}`;
    }

    if (type && type !== 'All') {
      params.push(type.toLowerCase());
      query += ` AND type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC`;
    const res = await db.query(query, params);
    return res.rows;
  }

  /**
   * Process Incoming WhatsApp Webhook Message
   * If message matches STOP / UNSUBSCRIBE / BAND KARO, adds to suppression list
   */
  async handleIncomingWhatsAppWebhook(tenantId, fromPhone, messageBody) {
    if (!fromPhone || !messageBody) {
      return { suppressed: false };
    }

    const text = messageBody.trim().toLowerCase();
    // Stop keyword patterns: STOP, UNSUBSCRIBE, BAND KARO, RUK JAO, MAT BHEJO, OPTOUT
    const stopRegex = /^(stop|unsubscribe|band\s*karo|ruk\s*jao|mat\s*bhejo|optout|opt-out)\b|\b(stop|unsubscribe|band\s*karo)\b/i;

    if (stopRegex.test(text)) {
      const normPhone = hygieneService.normalizePhone(fromPhone) || fromPhone.trim();
      const entry = await this.addSuppression(tenantId, 'phone', normPhone, 'stop_keyword');
      return {
        suppressed: true,
        reason: 'stop_keyword',
        normalizedPhone: normPhone,
        entry
      };
    }

    return { suppressed: false };
  }
}

module.exports = new SuppressionService();
