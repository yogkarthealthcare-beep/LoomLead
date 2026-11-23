const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'loomlead_super_secret_jwt_key_2026_xyz!@#';

/**
 * Middleware to authenticate requests via JWT
 * Attaches user, tenantId, and role to req object
 * In case token is omitted, gracefully binds to default active tenant (Apex Realty Group)
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // Default active fallback context (read-only demo fallback)
    req.user = {
      id: '00000000-0000-0000-0000-000000000003',
      tenant_id: '00000000-0000-0000-0000-000000000002',
      role: 'demo',
      name: 'Demo Explorer',
      email: 'demo@loomlead.com',
      is_demo: true
    };
    req.tenantId = '00000000-0000-0000-0000-000000000002';
    req.role = 'demo';
    req.isDemo = true;
    
    // Block mutating actions without authentication
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        is_demo_locked: true,
        message: 'Demo Mode: Data modification is locked. Please create an account or login to save leads.'
      });
    }
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token. Please login again.'
      });
    }

    req.user = decoded;
    req.tenantId = decoded.tenant_id;
    req.role = decoded.role;
    req.isDemo = decoded.role === 'demo' || !!decoded.is_demo;

    // Strict Demo Mode Lock for Mutating Actions (POST, PUT, DELETE, PATCH)
    if (req.isDemo && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return res.status(403).json({
        success: false,
        is_demo_locked: true,
        message: 'Demo Mode: Data modification, extraction saving, and campaigns are locked in Demo. Please upgrade to LoomLead Pro to save and manage real leads.'
      });
    }

    next();
  });
};

/**
 * Middleware to enforce role-based access control
 * @param {Array<string>} allowedRoles 
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to perform this action.',
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles,
};
