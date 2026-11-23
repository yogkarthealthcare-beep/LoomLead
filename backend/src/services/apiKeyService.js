const crypto = require('crypto');
const db = require('../config/db');

class ApiKeyService {
  /**
   * Generate and store a new API Key for a tenant
   * Returns the raw unhashed key only ONCE
   */
  async createApiKey(tenantId, name, scopes = ['leads:read', 'leads:write'], expiresAt = null) {
    if (!tenantId || !name) {
      throw new Error('Tenant ID and API Key name are required.');
    }

    // Generate secure 24-byte hex string -> 48 chars total
    const randomHex = crypto.randomBytes(24).toString('hex');
    const rawKey = `ll_live_${randomHex}`;
    const keyPrefix = rawKey.substring(0, 15) + '...';

    // Hash with SHA-256
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Valid scopes check
    const validScopes = ['leads:read', 'leads:write', '*'];
    const sanitizedScopes = (scopes || []).filter(s => validScopes.includes(s));
    if (sanitizedScopes.length === 0) {
      sanitizedScopes.push('leads:read', 'leads:write');
    }

    const insertQuery = `
      INSERT INTO api_keys (tenant_id, name, key_prefix, key_hash, scopes, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, key_prefix, scopes, expires_at, created_at
    `;

    const result = await db.query(insertQuery, [
      tenantId,
      name.trim(),
      keyPrefix,
      keyHash,
      sanitizedScopes,
      expiresAt || null
    ]);

    const created = result.rows[0];

    return {
      id: created.id,
      name: created.name,
      key_prefix: created.key_prefix,
      scopes: created.scopes,
      expires_at: created.expires_at,
      created_at: created.created_at,
      raw_key: rawKey // Only returned on creation
    };
  }

  /**
   * List all API keys for a tenant (never exposes raw key or key_hash)
   */
  async listApiKeys(tenantId) {
    const query = `
      SELECT id, name, key_prefix, scopes, last_used_at, expires_at, is_revoked, created_at
      FROM api_keys
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Revoke an API Key
   */
  async revokeApiKey(tenantId, keyId) {
    const query = `
      UPDATE api_keys 
      SET is_revoked = TRUE 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id, name, is_revoked
    `;
    const result = await db.query(query, [keyId, tenantId]);
    if (result.rows.length === 0) {
      throw new Error('API Key not found or does not belong to this tenant.');
    }
    return result.rows[0];
  }

  /**
   * Delete an API Key permanently
   */
  async deleteApiKey(tenantId, keyId) {
    const query = `
      DELETE FROM api_keys 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id, name
    `;
    const result = await db.query(query, [keyId, tenantId]);
    if (result.rows.length === 0) {
      throw new Error('API Key not found or does not belong to this tenant.');
    }
    return result.rows[0];
  }
}

module.exports = new ApiKeyService();
