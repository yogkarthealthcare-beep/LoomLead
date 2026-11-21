const db = require('../config/db');

/**
 * Middleware to check tenant plan status and limits
 * @param {string} featureName - optional feature name to check against plan features_json
 */
const checkPlanLimit = (featureName = null) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      if (!tenantId) {
        return res.status(400).json({ success: false, message: 'Tenant identifier missing.' });
      }

      // Query active subscription and plan details
      const subResult = await db.query(
        `SELECT s.status, s.expires_at, p.code as plan_code, p.limits_json, p.features_json
         FROM subscriptions s
         JOIN plans p ON s.plan_id = p.id
         WHERE s.tenant_id = $1
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [tenantId]
      );

      if (subResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          code: 'NO_PLAN',
          message: 'No active subscription found. Please select a plan to continue.',
        });
      }

      const subscription = subResult.rows[0];

      // Check if subscription has expired
      if (new Date(subscription.expires_at) < new Date() && subscription.status !== 'trial') {
        return res.status(403).json({
          success: false,
          code: 'PLAN_EXPIRED',
          message: 'Your subscription plan has expired. Please renew to continue using premium features.',
        });
      }

      // Check specific feature toggle if requested
      if (featureName && subscription.features_json) {
        if (!subscription.features_json[featureName]) {
          return res.status(403).json({
            success: false,
            code: 'FEATURE_LOCKED',
            feature: featureName,
            plan: subscription.plan_code,
            message: `The '${featureName}' feature is not available in your ${subscription.plan_code.toUpperCase()} plan. Please upgrade your subscription.`,
          });
        }
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Plan gating middleware error:', error);
      res.status(500).json({ success: false, message: 'Internal subscription verification error.' });
    }
  };
};

module.exports = {
  checkPlanLimit,
};
