const db = require('../config/db');

class ScoringService {
  getDefaultConfig() {
    return {
      weights: {
        no_website: 25,
        has_website: 5,
        rating_min_4: 20,
        rating_min_4_5: 5,
        reviews_min_20: 15,
        reviews_min_50: 5,
        has_phone: 10,
        has_email: 10,
        category_match: 10,
        whatsapp_reply: 15,
        email_open: 5,
        email_click: 10,
        recency_days_7: 10,
        recency_days_30: 5
      },
      rules: {
        target_categories: [
          'Real Estate',
          'Coaching',
          'Hospital',
          'Dental Clinic',
          'Interior Designer',
          'Business & Commercial',
          'IT & Software'
        ],
        web_agency_combo: {
          enabled: true,
          bonus_points: 15,
          conditions: {
            no_website: true,
            min_rating: 4.0,
            min_reviews: 20
          }
        }
      },
      thresholds: {
        hot: 70,
        warm: 40
      }
    };
  }

  /**
   * Fetch scoring config for tenant (or initialize default)
   */
  async getScoringConfig(tenantId) {
    const res = await db.query(
      `SELECT * FROM scoring_configs WHERE tenant_id = $1`,
      [tenantId]
    );

    if (res.rows.length > 0) {
      return res.rows[0].config;
    }

    // Default configuration
    const def = this.getDefaultConfig();
    await db.query(
      `INSERT INTO scoring_configs (tenant_id, name, config)
       VALUES ($1, 'Default Web Agency & B2B Scoring', $2)
       ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, JSON.stringify(def)]
    );
    return def;
  }

  /**
   * Update tenant's scoring config
   */
  async updateScoringConfig(tenantId, newConfig) {
    const res = await db.query(
      `INSERT INTO scoring_configs (tenant_id, name, config, updated_at)
       VALUES ($1, 'Custom Tenant Scoring Config', $2, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id)
       DO UPDATE SET config = EXCLUDED.config, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [tenantId, JSON.stringify(newConfig)]
    );
    return res.rows[0].config;
  }

  /**
   * Pure evaluation function: computes 0-100 score and explains WHY in score_breakdown
   */
  evaluateLead(lead, config = null) {
    const cfg = config || this.getDefaultConfig();
    const weights = cfg.weights || {};
    const rules = cfg.rules || {};
    const thresholds = cfg.thresholds || { hot: 70, warm: 40 };

    let totalScore = 0;
    const factors = [];

    // Helper to evaluate and track a factor
    const checkFactor = (ruleName, possiblePoints, earned, description, category = 'General') => {
      const pts = earned ? possiblePoints : 0;
      totalScore += pts;
      factors.push({
        rule: ruleName,
        name: ruleName,
        category,
        description,
        points: pts,
        max_points: possiblePoints,
        earned: pts,
        matched: earned
      });
    };

    // 1. Website Check (High priority for web agency use case)
    const hasWebsite = Boolean(lead.website || lead.normalized_domain);
    if (!hasWebsite) {
      checkFactor(
        'No Website (High Web Design Opportunity)',
        weights.no_website ?? 25,
        true,
        'Business operates without an official website — ideal prospect for website pitch'
      );
    } else {
      checkFactor(
        'Has Active Website',
        weights.has_website ?? 5,
        true,
        `Established online domain: ${lead.website || lead.normalized_domain}`
      );
    }

    // 2. Google Rating
    const rating = parseFloat(lead.google_rating) || 0;
    checkFactor(
      'Google Rating >= 4.0',
      weights.rating_min_4 ?? 20,
      rating >= 4.0,
      `Business rating is ${rating} ⭐`
    );
    checkFactor(
      'Top Tier Rating >= 4.5',
      weights.rating_min_4_5 ?? 5,
      rating >= 4.5,
      `Elite business reputation: ${rating} ⭐`
    );

    // 3. Review Count
    const reviews = parseInt(lead.review_count, 10) || 0;
    checkFactor(
      'Established Reviews >= 20',
      weights.reviews_min_20 ?? 15,
      reviews >= 20,
      `Has ${reviews} Google reviews demonstrating active client flow`
    );
    checkFactor(
      'High Review Volume >= 50',
      weights.reviews_min_50 ?? 5,
      reviews >= 50,
      `High volume of customer reviews (${reviews}+)`
    );

    // 4. Contact Information Completeness
    const hasPhone = Boolean(lead.phone || lead.normalized_phone);
    checkFactor(
      'Verified Phone Number',
      weights.has_phone ?? 10,
      hasPhone,
      hasPhone ? `Direct telephone available (${lead.phone})` : 'Missing telephone number'
    );

    const hasEmail = Boolean(lead.email && lead.email.includes('@'));
    checkFactor(
      'Direct Business Email',
      weights.has_email ?? 10,
      hasEmail,
      hasEmail ? `Email address on file (${lead.email})` : 'Missing email address'
    );

    // 5. Category Match
    const targetCategories = rules.target_categories || [];
    const categoryMatched = targetCategories.some(cat =>
      lead.category && lead.category.toLowerCase().includes(cat.toLowerCase())
    );
    checkFactor(
      'Target Industry / Category Match',
      weights.category_match ?? 10,
      categoryMatched,
      `Industry is "${lead.category || 'General'}"`
    );

    // 6. Web Agency Combo Rule
    if (rules.web_agency_combo?.enabled) {
      const comboCond = rules.web_agency_combo.conditions || {};
      const noWebOk = comboCond.no_website ? !hasWebsite : true;
      const ratingOk = rating >= (comboCond.min_rating || 4.0);
      const reviewsOk = reviews >= (comboCond.min_reviews || 20);
      const comboMatched = noWebOk && ratingOk && reviewsOk;

      if (comboMatched) {
        checkFactor(
          '🔥 Web Agency Sweet-Spot Combo Bonus',
          rules.web_agency_combo.bonus_points ?? 15,
          true,
          'Unmatched opportunity: High customer rating & review volume with NO website!'
        );
      }
    }

    // 7. Engagement: WhatsApp Reply
    const whatsappReplies = parseInt(lead.whatsapp_replies, 10) || 0;
    checkFactor(
      'WhatsApp Inbound Reply Received',
      weights.whatsapp_reply ?? 15,
      whatsappReplies > 0,
      whatsappReplies > 0 ? `Prospect engaged via WhatsApp (${whatsappReplies} replies)` : 'No WhatsApp replies yet'
    );

    // 8. Engagement: Email Opens & Clicks
    const emailOpens = parseInt(lead.email_opens, 10) || 0;
    checkFactor(
      'Email Opened by Lead',
      weights.email_open ?? 5,
      emailOpens > 0,
      emailOpens > 0 ? `Lead opened sequence emails (${emailOpens} opens)` : 'No email opens'
    );

    const emailClicks = parseInt(lead.email_clicks, 10) || 0;
    checkFactor(
      'Email Link Clicked',
      weights.email_click ?? 10,
      emailClicks > 0,
      emailClicks > 0 ? `Lead clicked outreach links (${emailClicks} clicks)` : 'No link clicks'
    );

    // 9. Recency
    const now = Date.now();
    const lastActive = new Date(lead.last_seen_at || lead.updated_at || lead.created_at || now).getTime();
    const daysSinceActive = Math.floor((now - lastActive) / 86400000);

    checkFactor(
      'Recent Activity (<= 7 Days)',
      weights.recency_days_7 ?? 10,
      daysSinceActive <= 7,
      `Last interaction or update was ${daysSinceActive} day(s) ago`
    );

    checkFactor(
      'Active within 30 Days',
      weights.recency_days_30 ?? 5,
      daysSinceActive <= 30 && daysSinceActive > 7,
      `Last active ${daysSinceActive} days ago`
    );

    // Clamp score between 0 and 100
    const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

    // Classify into buckets: Hot (>=70), Warm (40-69), Cold (<40)
    let bucket = 'Cold';
    if (finalScore >= thresholds.hot) {
      bucket = 'Hot';
    } else if (finalScore >= thresholds.warm) {
      bucket = 'Warm';
    }

    const breakdown = {
      total_score: finalScore,
      bucket,
      base_score: 50,
      net_adjustment: finalScore - 50,
      factors,
      computed_at: new Date().toISOString()
    };

    return {
      score_value: finalScore,
      score: bucket,
      score_breakdown: breakdown
    };
  }

  /**
   * Evaluates and updates a single lead in the database
   */
  async computeAndSaveLeadScore(tenantId, leadId, customConfig = null) {
    const config = customConfig || await this.getScoringConfig(tenantId);

    const leadRes = await db.query(
      `SELECT * FROM leads WHERE id = $1 AND tenant_id = $2 AND is_deleted = FALSE`,
      [leadId, tenantId]
    );

    if (leadRes.rows.length === 0) return null;
    const lead = leadRes.rows[0];

    const result = this.evaluateLead(lead, config);

    await db.query(
      `UPDATE leads
       SET score_value = $1,
           score = $2,
           score_breakdown = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND tenant_id = $5`,
      [result.score_value, result.score, JSON.stringify(result.score_breakdown), leadId, tenantId]
    );

    return {
      lead_id: leadId,
      ...result
    };
  }

  /**
   * Recalculates scores for ALL active leads of a tenant
   */
  async recalculateAllLeads(tenantId) {
    const config = await this.getScoringConfig(tenantId);

    const leadsRes = await db.query(
      `SELECT id FROM leads WHERE tenant_id = $1 AND is_deleted = FALSE`,
      [tenantId]
    );

    const leadIds = leadsRes.rows.map(r => r.id);
    const scoringQueue = require('./scoringQueue');

    for (const leadId of leadIds) {
      scoringQueue.enqueue(tenantId, leadId, config);
    }

    return {
      total_queued: leadIds.length
    };
  }

  /**
   * Record engagement event (whatsapp reply, email open, click) and queue rescore
   */
  async recordEngagementEvent(tenantId, leadId, type) {
    let updateColumn = null;
    if (type === 'whatsapp_reply') updateColumn = 'whatsapp_replies';
    else if (type === 'email_open') updateColumn = 'email_opens';
    else if (type === 'email_click') updateColumn = 'email_clicks';

    if (!updateColumn) {
      throw new Error(`Invalid engagement event type: ${type}`);
    }

    await db.query(
      `UPDATE leads 
       SET ${updateColumn} = ${updateColumn} + 1, last_seen_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );

    const scoringQueue = require('./scoringQueue');
    scoringQueue.enqueue(tenantId, leadId);

    return { success: true, type, leadId };
  }
}

module.exports = new ScoringService();
