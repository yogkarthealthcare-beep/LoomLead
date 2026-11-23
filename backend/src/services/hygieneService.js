/**
 * Data Hygiene & Deduplication Engine
 * 1. Normalize Phone to E.164 (Default Country: IN)
 * 2. Normalize Domain (lowercase, strip protocol, www, paths)
 * 3. Smart Deduplicating Upsert & Merge
 */

class HygieneService {
  /**
   * Normalize Phone to E.164 standard (+[country_code][number])
   * Default country code: +91 (India)
   */
  normalizePhone(rawPhone, defaultCountry = 'IN') {
    if (!rawPhone || typeof rawPhone !== 'string') return null;

    // 1. Trim and remove whitespace, dashes, parens, dots
    let clean = rawPhone.trim().replace(/[\s\-\(\)\.]+/g, '');
    if (!clean) return null;

    // 2. If it already starts with '+', keep '+' and verify digits
    if (clean.startsWith('+')) {
      const digits = clean.substring(1).replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        return `+${digits}`;
      }
      return null;
    }

    // Strip any remaining non-digit characters
    const digitsOnly = clean.replace(/\D/g, '');
    if (!digitsOnly) return null;

    if (defaultCountry === 'IN') {
      // 10 digits (Standard Indian mobile e.g. 9820112345)
      if (digitsOnly.length === 10) {
        return `+91${digitsOnly}`;
      }
      // 11 digits starting with 0 (STD / mobile e.g. 09820112345, 08174800330)
      if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
        return `+91${digitsOnly.substring(1)}`;
      }
      // 12 digits starting with 91 (e.g. 919820112345)
      if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        return `+${digitsOnly}`;
      }
      // 13 digits starting with 091
      if (digitsOnly.length === 13 && digitsOnly.startsWith('091')) {
        return `+${digitsOnly.substring(1)}`;
      }
    }

    // Generic fallback for international numbers without '+'
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return `+${digitsOnly}`;
    }

    return null;
  }

  /**
   * Normalize Domain
   * Strips protocol (http/https), www., paths, query params, hash, and converts to lowercase
   */
  normalizeDomain(rawUrlOrDomain) {
    if (!rawUrlOrDomain || typeof rawUrlOrDomain !== 'string') return null;

    let str = rawUrlOrDomain.trim().toLowerCase();
    if (!str) return null;

    // Remove protocol
    str = str.replace(/^[a-z]+:\/\//, '');

    // Remove username/password if any
    if (str.includes('@')) {
      str = str.split('@').pop();
    }

    // Remove path, query params, hash
    str = str.split('/')[0].split('?')[0].split('#')[0];

    // Remove port if present
    str = str.split(':')[0];

    // Strip leading www. or www[0-9].
    str = str.replace(/^www\d*\./, '');

    // Validate domain has at least one dot and valid chars
    if (!str.includes('.') || str.endsWith('.')) {
      return null;
    }

    return str || null;
  }

  /**
   * Atomic Lead Ingestion with Deduplication & Merge
   * Checks for duplicate on (tenant_id, normalized_phone) or (tenant_id, normalized_domain).
   * If duplicate exists: merges/enriches empty fields, appends source, updates last_seen_at.
   * If new: inserts fresh lead.
   */
  async upsertLead(client, tenantId, leadData, defaultStageId, assignedUserId) {
    const rawPhone = leadData.phone || '';
    const normPhone = this.normalizePhone(rawPhone);

    // Extract domain from website or email
    let rawDomain = leadData.website || leadData.domain || '';
    if (!rawDomain && leadData.email && leadData.email.includes('@')) {
      const emailDomain = leadData.email.split('@')[1];
      // Exclude generic public email domains for company domain matching
      const genericEmails = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'rediffmail.com'];
      if (!genericEmails.includes(emailDomain.toLowerCase())) {
        rawDomain = emailDomain;
      }
    }
    const normDomain = this.normalizeDomain(rawDomain);

    const source = leadData.source || 'Manual Entry';

    // 1. Check for existing duplicate lead within this tenant
    let dupQuery = `
      SELECT * FROM leads 
      WHERE tenant_id = $1 AND is_deleted = FALSE AND (
        ($2::varchar IS NOT NULL AND normalized_phone = $2)
        OR
        ($3::varchar IS NOT NULL AND normalized_domain = $3)
      )
      LIMIT 1
    `;
    const dupRes = await client.query(dupQuery, [tenantId, normPhone, normDomain]);

    if (dupRes.rows.length > 0) {
      const existing = dupRes.rows[0];

      // Merge: Enrich only fields that are currently empty or placeholder in existing lead
      const mergedEmail = existing.email || leadData.email || null;
      const isPlaceholderCompany = !existing.company_name || existing.company_name === 'N/A' || existing.company_name === existing.name;
      const mergedCompany = isPlaceholderCompany && leadData.company_name ? leadData.company_name : (existing.company_name || leadData.company_name || 'N/A');
      const mergedCategory = (existing.category && existing.category !== 'Business & Commercial') ? existing.category : (leadData.category || existing.category || 'Business & Commercial');
      const mergedAddress = existing.address || leadData.address || null;
      const mergedCity = (existing.city && existing.city !== 'India') ? existing.city : (leadData.city || existing.city || 'India');
      const mergedBudgetValue = (parseFloat(existing.budget_value) > 0) ? existing.budget_value : (leadData.budget_value || 0);
      const mergedNotes = existing.notes ? (leadData.notes && !existing.notes.includes(leadData.notes) ? `${existing.notes} | ${leadData.notes}` : existing.notes) : leadData.notes;

      // Update existing record
      const updateQuery = `
        UPDATE leads 
        SET email = $1,
            company_name = $2,
            category = $3,
            address = $4,
            city = $5,
            budget_value = $6,
            notes = $7,
            normalized_phone = COALESCE(normalized_phone, $8),
            normalized_domain = COALESCE(normalized_domain, $9),
            sources = (
              SELECT array_agg(DISTINCT s) 
              FROM unnest(array_cat(COALESCE(sources, ARRAY[]::text[]), ARRAY[$10::text])) AS s
            ),
            last_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $11 AND tenant_id = $12
        RETURNING *
      `;
      const updateRes = await client.query(updateQuery, [
        mergedEmail,
        mergedCompany,
        mergedCategory,
        mergedAddress,
        mergedCity,
        mergedBudgetValue,
        mergedNotes,
        normPhone,
        normDomain,
        source,
        existing.id,
        tenantId
      ]);

      return {
        lead: updateRes.rows[0],
        isDuplicate: true,
        merged: true,
        action: 'merged'
      };
    }

    // 2. New Lead: Insert fresh row
    const insertQuery = `
      INSERT INTO leads 
      (tenant_id, name, phone, email, company_name, category, address, city, 
       source, status, score, stage_id, assigned_to_user_id, budget_value, notes, 
       normalized_phone, normalized_domain, sources, last_seen_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, ARRAY[$18::text], CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const insertRes = await client.query(insertQuery, [
      tenantId,
      leadData.name || 'New Prospect',
      leadData.phone || '',
      leadData.email || null,
      leadData.company_name || leadData.name || 'N/A',
      leadData.category || 'Business & Commercial',
      leadData.address || null,
      leadData.city || 'India',
      source,
      leadData.status || 'New',
      leadData.score || 'Warm',
      defaultStageId || null,
      assignedUserId || null,
      leadData.budget_value || 0,
      leadData.notes || null,
      normPhone,
      normDomain,
      source
    ]);

    return {
      lead: insertRes.rows[0],
      isDuplicate: false,
      merged: false,
      action: 'created'
    };
  }
}

module.exports = new HygieneService();
