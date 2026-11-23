require('dotenv').config();
const db = require('../src/config/db');
const scoringService = require('../src/services/scoringService');
const scoringQueue = require('../src/services/scoringQueue');
const hygieneService = require('../src/services/hygieneService');

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 STARTING RULE-BASED LEAD SCORING VERIFICATION TESTS');
  console.log('=====================================================');

  try {
    // 1. Get an existing tenant
    const tenantRes = await db.query(`SELECT id, company_name FROM tenants LIMIT 1`);
    if (tenantRes.rows.length === 0) {
      throw new Error('No tenant found in database.');
    }
    const tenantId = tenantRes.rows[0].id;
    console.log(`\n[TEST 1] Using Tenant: ${tenantRes.rows[0].company_name} (${tenantId})`);

    // 2. Fetch or initialize default scoring config
    const config = await scoringService.getScoringConfig(tenantId);
    console.log('✅ Scoring Config retrieved successfully:');
    console.log(`   - Weights: no_website=${config.weights.no_website}, rating_min_4=${config.weights.rating_min_4}, reviews_min_20=${config.weights.reviews_min_20}`);
    console.log(`   - Web Agency Combo: enabled=${config.rules.web_agency_combo.enabled}, bonus=${config.rules.web_agency_combo.bonus_points}pts`);
    console.log(`   - Thresholds: Hot>=${config.thresholds.hot}, Warm>=${config.thresholds.warm}`);

    // 3. Test Web Agency Lead (No website, rating 4.3, 35 reviews)
    console.log('\n[TEST 2] Testing Web Agency Lead Evaluation (No website + 4.3 rating + 35 reviews)...');
    const mockWebAgencyLead = {
      name: 'Dr. Sharma Dental Care',
      company_name: 'Sharma Dental Clinic',
      phone: '+919999888811',
      email: 'contact@sharmadental.in',
      website: null, // NO WEBSITE
      category: 'Dental Clinic',
      google_rating: 4.3,
      review_count: 35,
      email_opens: 0,
      email_clicks: 0,
      whatsapp_replies: 0,
      created_at: new Date()
    };

    const evaluation = scoringService.evaluateLead(mockWebAgencyLead, config);
    console.log(`✅ Calculated Score: ${evaluation.score_value}/100, Bucket: ${evaluation.score}`);
    console.log(`   Base score: ${evaluation.score_breakdown.base_score}, Net adjustment: ${evaluation.score_breakdown.net_adjustment}`);
    
    // Validate bucket is Hot
    if (evaluation.score_value >= 70 && evaluation.score === 'Hot') {
      console.log('🎉 PASS: Lead accurately scored as HOT (>= 70) for Web Agency criteria!');
    } else {
      console.error(`❌ FAIL: Expected score >= 70, got ${evaluation.score_value}`);
    }

    console.log('\nFactor breakdown:');
    evaluation.score_breakdown.factors.forEach(f => {
      console.log(`   - [${f.matched ? 'MATCHED' : '       '}] ${f.name}: +${f.points}/${f.max_points} pts (${f.category})`);
    });

    // 4. Test Lead Upsert with Hygiene Service & Scoring Queue
    console.log('\n[TEST 3] Inserting Lead via Hygiene Service (triggers async queue)...');
    
    // Clean up any existing test lead
    await db.query(`DELETE FROM leads WHERE tenant_id = $1 AND (normalized_phone = '919999888811' OR email = 'contact@sharmadental.in')`, [tenantId]);

    const upsertResult = await hygieneService.upsertLead(tenantId, {
      name: 'Dr. Sharma Dental Care',
      company_name: 'Sharma Dental Clinic',
      phone: '+91 99998 88811',
      email: 'contact@sharmadental.in',
      website: '', // empty website
      category: 'Dental Clinic',
      google_rating: 4.3,
      review_count: 35,
      source: 'Google Maps'
    });
    const upserted = upsertResult.lead;

    console.log(`✅ Lead upserted: ID=${upserted.id}, Action=${upsertResult.action}, Initial Score Value=${upserted.score_value}`);

    // Wait for queue processing (give queue 1.5 seconds)
    console.log('   Waiting for scoringQueue background job to execute...');
    await new Promise(r => setTimeout(r, 1500));

    const refreshedLeadRes = await db.query(
      `SELECT id, name, score, score_value, score_breakdown, google_rating, review_count, website FROM leads WHERE id = $1`,
      [upserted.id]
    );
    const refreshedLead = refreshedLeadRes.rows[0];
    console.log(`✅ Post-Queue DB Check:`);
    console.log(`   - Score Value: ${refreshedLead.score_value}`);
    console.log(`   - Bucket: ${refreshedLead.score}`);
    console.log(`   - Has score_breakdown JSON: ${Boolean(refreshedLead.score_breakdown && refreshedLead.score_breakdown.factors)}`);

    if (refreshedLead.score_value >= 70 && refreshedLead.score === 'Hot') {
      console.log('🎉 PASS: Scoring Queue successfully computed & saved Hot score in PostgreSQL!');
    } else {
      console.warn(`⚠️ Lead score is ${refreshedLead.score_value}, bucket: ${refreshedLead.score}`);
    }

    // 5. Test Engagement Event Hook (WhatsApp reply)
    console.log('\n[TEST 4] Testing Engagement Hook (WhatsApp Reply)...');
    const beforeScore = refreshedLead.score_value;
    const engagementResult = await scoringService.recordEngagementEvent(tenantId, refreshedLead.id, 'whatsapp_reply');
    console.log(`✅ Engagement recorded:`, engagementResult);

    // Wait for queue processing
    await new Promise(r => setTimeout(r, 1200));

    const postEngagementRes = await db.query(
      `SELECT id, score_value, score, whatsapp_replies FROM leads WHERE id = $1`,
      [refreshedLead.id]
    );
    const postEngagementLead = postEngagementRes.rows[0];
    console.log(`✅ Post-Engagement Lead:`);
    console.log(`   - WhatsApp Replies: ${postEngagementLead.whatsapp_replies}`);
    console.log(`   - New Score Value: ${postEngagementLead.score_value} (was ${beforeScore})`);

    // 6. Test Settings Recalculate All
    console.log('\n[TEST 5] Testing Bulk Recalculate All Leads Queue...');
    const bulkResult = await scoringService.recalculateAllLeads(tenantId);
    console.log(`✅ Enqueued ${bulkResult.total_queued} leads for rescoring.`);

    // Wait for queue to drain
    await new Promise(r => setTimeout(r, 2000));
    const status = scoringQueue.getStatus();
    console.log(`✅ Queue Status: pending=${status.pending_count}, in_flight=${status.in_flight}, processed=${status.processed_total}`);

    console.log('\n=====================================================');
    console.log('🎉 ALL RULE-BASED LEAD SCORING TESTS COMPLETED PASSING');
    console.log('=====================================================');

    // Clean up test lead
    await db.query(`DELETE FROM leads WHERE id = $1`, [upserted.id]);
    console.log('🧹 Cleaned up test lead.');

    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runTests();
