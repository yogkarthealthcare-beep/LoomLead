const db = require('../config/db');

/**
 * Controller for CRM Dashboard KPIs and Chart.js Analytics
 */
const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { period = '30days' } = req.query;

    // 1. KPI Aggregations
    const kpiQuery = await db.query(
      `SELECT 
         COUNT(*) as total_leads,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today,
         COUNT(*) FILTER (WHERE score = 'Hot') as hot_leads,
         COUNT(*) FILTER (WHERE status = 'Won') as won_leads,
         COUNT(*) FILTER (WHERE status = 'Lost') as lost_leads,
         COALESCE(SUM(budget_value) FILTER (WHERE status = 'Won'), 0) as total_won_revenue,
         COALESCE(SUM(budget_value), 0) as total_pipeline_value
       FROM leads
       WHERE tenant_id = $1 AND is_deleted = FALSE`,
      [tenantId]
    );

    const kpi = kpiQuery.rows[0];
    const totalLeads = parseInt(kpi.total_leads) || 0;
    const wonLeads = parseInt(kpi.won_leads) || 0;
    const conversionRate = totalLeads > 0 ? ((wonLeads / totalLeads) * 100).toFixed(1) : 0;

    // 2. Call Logs stats
    const callsQuery = await db.query(
      `SELECT 
         COUNT(*) as total_calls,
         COUNT(*) FILTER (WHERE call_date >= CURRENT_DATE) as calls_today,
         COUNT(*) FILTER (WHERE outcome = 'connected') as connected_calls
       FROM call_logs
       WHERE tenant_id = $1`,
      [tenantId]
    );
    const callStats = callsQuery.rows[0];

    // 3. Leads by Source (Chart.js Doughnut)
    const sourceQuery = await db.query(
      `SELECT source, COUNT(*) as count 
       FROM leads 
       WHERE tenant_id = $1 AND is_deleted = FALSE 
       GROUP BY source ORDER BY count DESC LIMIT 5`,
      [tenantId]
    );

    // 4. Monthly Revenue & Leads Trend (Chart.js Line)
    const trendQuery = await db.query(
      `SELECT 
         TO_CHAR(created_at, 'Mon YYYY') as month,
         DATE_TRUNC('month', created_at) as month_date,
         COUNT(*) as leads_count,
         COALESCE(SUM(budget_value), 0) as revenue
       FROM leads
       WHERE tenant_id = $1 AND is_deleted = FALSE
       GROUP BY month, month_date
       ORDER BY month_date ASC
       LIMIT 6`,
      [tenantId]
    );

    // 5. Pipeline Stages Funnel (Chart.js Bar)
    const funnelQuery = await db.query(
      `SELECT ps.name as stage_name, ps.color_hex, COUNT(l.id) as count, COALESCE(SUM(l.budget_value), 0) as total_value
       FROM pipeline_stages ps
       LEFT JOIN leads l ON l.stage_id = ps.id AND l.tenant_id = $1 AND l.is_deleted = FALSE
       WHERE ps.tenant_id = $1
       GROUP BY ps.id, ps.name, ps.order_index, ps.color_hex
       ORDER BY ps.order_index ASC`,
      [tenantId]
    );

    // 6. Tasks Due Today
    const todayTasksQuery = await db.query(
      `SELECT t.id, t.title, t.type, t.priority, t.due_date, t.status, l.name as lead_name, l.phone as lead_phone
       FROM tasks t
       LEFT JOIN leads l ON t.lead_id = l.id
       WHERE t.tenant_id = $1 AND t.due_date::date = CURRENT_DATE
       ORDER BY t.due_date ASC LIMIT 5`,
      [tenantId]
    );

    // 7. Plan Usage Meter
    const usageQuery = await db.query(
      `SELECT 
         (SELECT COUNT(*) FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE) as current_leads,
         (SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND status = 'active') as current_users,
         (SELECT limits_json FROM plans p JOIN subscriptions s ON s.plan_id = p.id WHERE s.tenant_id = $1 LIMIT 1) as plan_limits`,
      [tenantId]
    );

    const usage = usageQuery.rows[0] || {};
    const limits = usage.plan_limits || { max_leads: 1000, max_users: 3 };

    res.json({
      success: true,
      data: {
        kpi: {
          total_leads: totalLeads,
          new_today: parseInt(kpi.new_today) || 0,
          hot_leads: parseInt(kpi.hot_leads) || 0,
          won_leads: wonLeads,
          lost_leads: parseInt(kpi.lost_leads) || 0,
          conversion_rate_percent: parseFloat(conversionRate),
          won_revenue: parseFloat(kpi.total_won_revenue) || 0,
          pipeline_value: parseFloat(kpi.total_pipeline_value) || 0,
          calls_today: parseInt(callStats.calls_today) || 0,
          total_calls: parseInt(callStats.total_calls) || 0,
        },
        charts: {
          leads_by_source: {
            labels: sourceQuery.rows.map((r) => r.source),
            datasets: [{ data: sourceQuery.rows.map((r) => parseInt(r.count)) }],
          },
          revenue_trend: {
            labels: trendQuery.rows.map((r) => r.month),
            leads: trendQuery.rows.map((r) => parseInt(r.leads_count)),
            revenue: trendQuery.rows.map((r) => parseFloat(r.revenue)),
          },
          funnel: {
            stages: funnelQuery.rows.map((r) => r.stage_name),
            counts: funnelQuery.rows.map((r) => parseInt(r.count)),
            values: funnelQuery.rows.map((r) => parseFloat(r.total_value)),
            colors: funnelQuery.rows.map((r) => r.color_hex),
          },
        },
        tasks_today: todayTasksQuery.rows,
        plan_usage: {
          leads: { current: parseInt(usage.current_leads) || 0, max: limits.max_leads || 1000 },
          users: { current: parseInt(usage.current_users) || 0, max: limits.max_users || 3 },
        },
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve dashboard analytics.' });
  }
};

module.exports = {
  getDashboardStats,
};
