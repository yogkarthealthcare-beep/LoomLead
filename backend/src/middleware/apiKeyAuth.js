const crypto = require('crypto');
const db = require('../config/db');

/**
 * Authenticates Public REST API requests using Tenant API Keys
 * Expects key in header:
 *   X-API-Key: ll_live_...
 *   OR
 *   Authorization: Bearer ll_live_...
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    let rawKey = req.headers['x-api-key'];

    if (!rawKey) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        rawKey = authHeader.substring(7).trim();
      }
    }

    if (!rawKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing API Key. Provide X-API-Key header or Authorization: Bearer <key>.'
      });
    }

    if (!rawKey.startsWith('ll_live_') || rawKey.length < 20) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid API Key format. Keys must start with "ll_live_".'
      });
    }

    // Compute SHA-256 hash
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    // Query active key from database
    const query = `
      SELECT id, tenant_id, name, key_prefix, scopes, expires_at, is_revoked 
      FROM api_keys 
      WHERE key_hash = $1
      LIMIT 1
    `;
    const result = await db.query(query, [keyHash]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: API Key not found or invalid.'
      });
    }

    const keyData = result.rows[0];

    if (keyData.is_revoked) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: This API Key has been revoked.'
      });
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: This API Key has expired.'
      });
    }

    // Update last_used_at timestamp in background
    db.query(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [keyData.id])
      .catch(err => console.error('[APIKeyAuth] Error updating last_used_at:', err.message));

    // Bind tenant and key info to request
    req.tenantId = keyData.tenant_id;
    req.apiKey = keyData;
    req.scopes = keyData.scopes || [];

    next();
  } catch (err) {
    console.error('[APIKeyAuth] Authentication error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error validating API Key.'
    });
  }
};

/**
 * Scope enforcement middleware
 * @param {string} requiredScope (e.g. 'leads:read' or 'leads:write')
 */
const requireScope = (requiredScope) => {
  return (req, res, next) => {
    const scopes = req.scopes || [];
    if (scopes.includes('*') || scopes.includes(requiredScope)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: `Forbidden: Insufficient permissions. Required scope: '${requiredScope}'. Granted scopes: [${scopes.join(', ')}].`
    });
  };
};

module.exports = {
  authenticateApiKey,
  requireScope
};
