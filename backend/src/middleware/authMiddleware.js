const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'loomlead_super_secret_jwt_key_2026_xyz!@#';

/**
 * Middleware to authenticate requests via JWT
 * Attaches user, tenantId, and role to req object
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token missing. Please log in to proceed.',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.',
      });
    }

    req.user = decoded;
    req.tenantId = decoded.tenant_id;
    req.role = decoded.role;
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
