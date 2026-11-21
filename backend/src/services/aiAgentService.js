const db = require('../config/db');
const axios = require('axios');

/**
 * Built-in AI Agent Copilot Service
 * Parses user voice/text commands in English, Hindi, and Hinglish.
 * Suggests actions, navigates pages, schedules tasks, queries analytics, and executes CRM workflows.
 */
class AIAgentService {
  /**
   * Process natural language query from CRM user
   * @param {string} prompt - User instruction, e.g. "Hot leads dikhao", "Open settings", "Create task to call Rahul"
   * @param {string} tenantId - Tenant UUID
   * @param {string} userId - User UUID
   * @param {object} currentContext - Current active URL or page context
   */
  async processCommand(prompt, tenantId, userId, currentContext = {}) {
    const cleanPrompt = (prompt || '').trim().toLowerCase();

    // 1. Navigation Commands Intent Detection
    if (this.matchesAny(cleanPrompt, ['hot lead', 'hot leads', 'urgent leads'])) {
      return {
        message: 'Opening your Hot Leads pipeline now.',
        action: {
          type: 'NAVIGATE',
          route: '/leads',
          queryParams: { score: 'Hot' },
        },
        suggestion: 'You have 8 Hot leads requiring follow-up today.',
      };
    }

    if (this.matchesAny(cleanPrompt, ['open lead', 'leads page', 'leads list', 'contacts page', 'lead dikhao', 'lead list'])) {
      return {
        message: 'Navigating to Leads Management.',
        action: { type: 'NAVIGATE', route: '/leads' },
      };
    }

    if (this.matchesAny(cleanPrompt, ['pipeline', 'kanban', 'stages', 'funnel', 'pipeline board'])) {
      return {
        message: 'Opening the Sales Pipeline Kanban board.',
        action: { type: 'NAVIGATE', route: '/pipeline' },
      };
    }

    if (this.matchesAny(cleanPrompt, ['task', 'follow up', 'follow-up', 'followups', 'tasks dikhao', 'reminders'])) {
      return {
        message: 'Opening Tasks and Call Follow-ups.',
        action: { type: 'NAVIGATE', route: '/tasks' },
      };
    }

    if (this.matchesAny(cleanPrompt, ['google map', 'gmap', 'scraper', 'find leads', 'lead generator', 'new business'])) {
      return {
        message: 'Opening Google Maps Lead Discovery Engine.',
        action: { type: 'NAVIGATE', route: '/google-maps-leads' },
        suggestion: 'Trending: "Interior Designers in Mumbai" has high lead conversion this week.',
      };
    }

    if (this.matchesAny(cleanPrompt, ['report', 'reports', 'analytics', 'charts', 'graph', 'revenue report', 'stats'])) {
      return {
        message: 'Opening CRM Reports & Analytics Dashboard.',
        action: { type: 'NAVIGATE', route: '/reports' },
      };
    }

    if (this.matchesAny(cleanPrompt, ['invoice', 'invoices', 'bill', 'billing', 'payments', 'quotes', 'quotation'])) {
      return {
        message: 'Opening Invoices & Payments.',
        action: { type: 'NAVIGATE', route: '/invoices' },
      };
    }

    if (this.matchesAny(cleanPrompt, ['settings', 'setting', 'custom fields', 'company profile', 'industry'])) {
      return {
        message: 'Opening CRM Settings & Industry Configuration.',
        action: { type: 'NAVIGATE', route: '/settings' },
      };
    }

    // 2. Action: Create Task / Call Follow-up
    // Example: "Call Rahul tomorrow at 3pm" / "Rahul ko call karne ka task banao"
    if (this.matchesAny(cleanPrompt, ['task banao', 'create task', 'schedule call', 'call karna hai', 'remind me to call'])) {
      return this.handleCreateTaskIntent(prompt, tenantId, userId);
    }

    // 3. Query / Summary Intent: Revenue, Calls made, Won deals
    if (this.matchesAny(cleanPrompt, ['kya haal hai', 'summary', 'aaj ka summary', 'kitne lead aye', 'how many leads', 'revenue kitna hai', 'total calls'])) {
      return this.handleSummaryQuery(tenantId);
    }

    // 4. Default Intelligent Fallback
    return {
      message: `Maine aapka message samjha: "${prompt}". Aap mujhse keh sakte hain:\n- "Hot leads dikhao"\n- "Google Maps scraper open karo"\n- "Rahul ko call karne ka task banao"\n- "Aaj ka summary batao"\n- "Invoices page open karo"`,
      action: null,
      suggestions: [
        'Open Hot Leads',
        'Find Leads on Google Maps',
        'Show Today\'s Follow-ups',
        'View Pipeline'
      ]
    };
  }

  /**
   * Helper to parse and create task from speech/text
   */
  async handleCreateTaskIntent(rawPrompt, tenantId, userId) {
    try {
      // Basic heuristic title extraction
      let title = rawPrompt;
      if (rawPrompt.toLowerCase().includes('task banao')) {
        title = rawPrompt.replace(/task banao/i, '').trim();
      } else if (rawPrompt.toLowerCase().includes('create task')) {
        title = rawPrompt.replace(/create task/i, '').trim();
      }

      const dueTomorrow = new Date();
      dueTomorrow.setDate(dueTomorrow.getDate() + 1);
      dueTomorrow.setHours(15, 0, 0, 0);

      const taskResult = await db.query(
        `INSERT INTO tasks (tenant_id, assigned_to_user_id, title, type, priority, due_date, status)
         VALUES ($1, $2, $3, 'Call', 'High', $4, 'Pending')
         RETURNING id, title, due_date`,
        [tenantId, userId, title || 'Follow up with client', dueTomorrow]
      );

      return {
        message: `Task successfully scheduled: "${title || 'Follow up with client'}" for Tomorrow at 3:00 PM.`,
        action: {
          type: 'TASK_CREATED',
          task: taskResult.rows[0],
          toast: 'Follow-up Task added to your calendar!'
        },
        suggestion: 'View your tasks board to reschedule or add notes.'
      };
    } catch (err) {
      console.error('AI create task error:', err);
      return {
        message: 'Could not automatically schedule task. Opening task creation form for you.',
        action: { type: 'OPEN_MODAL', modalId: 'createTaskModal' }
      };
    }
  }

  /**
   * Summary query for dashboard
   */
  async handleSummaryQuery(tenantId) {
    const stats = await db.query(
      `SELECT 
         COUNT(*) as total_leads,
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today,
         COUNT(*) FILTER (WHERE score = 'Hot') as hot_leads,
         COUNT(*) FILTER (WHERE status = 'Won') as won_leads
       FROM leads 
       WHERE tenant_id = $1 AND is_deleted = FALSE`,
      [tenantId]
    );

    const row = stats.rows[0] || {};
    return {
      message: `📊 Aaj ka quick summary:\n- Total Leads: ${row.total_leads || 0}\n- New Leads Today: ${row.new_today || 0}\n- Hot Deals Pending: ${row.hot_leads || 0}\n- Won Deals: ${row.won_leads || 0}`,
      action: { type: 'NAVIGATE', route: '/dashboard' },
      suggestions: ['View Today\'s Overdue Calls', 'Open Pipeline Kanban', 'Export Report']
    };
  }

  matchesAny(text, keywords) {
    return keywords.some((kw) => text.includes(kw));
  }
}

module.exports = new AIAgentService();
