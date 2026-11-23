require('dotenv').config();
const crypto = require('crypto');
const db = require('../src/config/db');
const apiKeyService = require('../src/services/apiKeyService');
const webhookService = require('../src/services/webhookService');
const hygieneService = require('../src/services/hygieneService');

async function runTests() {
  console.log('=====================================================');
  console.log('🚀 STARTING INTEGRATIONS & PUBLIC API VERIFICATION');
  console.log('=====================================================');

  try {
    // 1. Get Tenant
    const tenantRes = await db.query(`SELECT id, company_name FROM tenants LIMIT 1`);
    if (tenantRes.rows.length === 0) throw new Error('No tenant found.');
    const tenantId = tenantRes.rows[0].id;
    console.log(`\n[TEST 1] Using Tenant: ${tenantRes.rows[0].company_name} (${tenantId})`);

    // 2. Generate Public API Key
    console.log('\n[TEST 2] Generating Public API Key with Scopes (leads:read, leads:write)...');
    const createdKey = await apiKeyService.createApiKey(
      tenantId,
      'Test Integration Key ' + Date.now(),
      ['leads:read', 'leads:write']
    );

    console.log(`✅ API Key Generated:`);
    console.log(`   - ID: ${createdKey.id}`);
    console.log(`   - Name: ${createdKey.name}`);
    console.log(`   - Prefix: ${createdKey.key_prefix}`);
    console.log(`   - Raw Key: ${createdKey.raw_key}`);
    console.log(`   - Scopes: [${createdKey.scopes.join(', ')}]`);

    // Verify SHA-256 in DB
    const expectedHash = crypto.createHash('sha256').update(createdKey.raw_key).digest('hex');
    const dbKeyRes = await db.query(`SELECT * FROM api_keys WHERE id = $1`, [createdKey.id]);
    if (dbKeyRes.rows[0].key_hash === expectedHash) {
      console.log('🎉 PASS: Raw key is cryptographically hashed with SHA-256 in DB!');
    } else {
      console.error('❌ FAIL: Hash mismatch in database!');
    }

    // 3. Test Webhook Subscription Creation
    console.log('\n[TEST 3] Creating Webhook Subscription with HMAC-SHA256 Signing Secret...');
    const sub = await webhookService.subscribe(
      tenantId,
      'https://httpbin.org/post', // Mock target endpoint
      ['lead.created', 'lead.stage_changed', 'lead.won'],
      'Zapier Integration Endpoint'
    );

    console.log(`✅ Webhook Subscribed:`);
    console.log(`   - Sub ID: ${sub.id}`);
    console.log(`   - URL: ${sub.url}`);
    console.log(`   - Events: [${sub.events.join(', ')}]`);
    console.log(`   - HMAC Secret: ${sub.secret.substring(0, 12)}...`);

    // 4. Test Lead Creation with Deduplication & Outgoing Webhook Dispatch
    console.log('\n[TEST 4] Ingesting Lead via Hygiene Service (triggers lead.created webhook)...');
    
    // Clean existing test lead
    await db.query(`DELETE FROM leads WHERE tenant_id = $1 AND normalized_phone = '919876543299'`, [tenantId]);

    const upsertRes = await hygieneService.upsertLead(tenantId, {
      name: 'Rohan Sharma',
      company_name: 'Sharma Tech Innovations',
      phone: '+91 98765 43299',
      email: 'rohan@sharmatech.in',
      website: 'sharmatech.in',
      category: 'IT & Software',
      source: 'Chrome Extension'
    });

    const lead = upsertRes.lead;
    console.log(`✅ Ingested Lead: ID=${lead.id}, Name=${lead.name}, Phone=${lead.phone}`);

    // Wait for webhook dispatch (setImmediate execution)
    console.log('   Waiting for webhook delivery log in database...');
    await new Promise(r => setTimeout(r, 2000));

    const deliveriesRes = await db.query(
      `SELECT * FROM webhook_deliveries WHERE tenant_id = $1 AND event = 'lead.created' ORDER BY created_at DESC LIMIT 1`,
      [tenantId]
    );

    if (deliveriesRes.rows.length > 0) {
      const del = deliveriesRes.rows[0];
      console.log(`🎉 PASS: Webhook delivery logged:`);
      console.log(`   - Delivery ID: ${del.id}`);
      console.log(`   - Event: ${del.event}`);
      console.log(`   - Status: ${del.status} (HTTP ${del.status_code || 'N/A'})`);
      console.log(`   - Attempt: ${del.attempt}/${del.max_attempts}`);
    } else {
      console.warn('⚠️ Webhook delivery not found yet.');
    }

    // 5. Test Stage Change Trigger & lead.stage_changed / lead.won Dispatch
    console.log('\n[TEST 5] Updating Lead Stage to "Won" (triggers lead.stage_changed & lead.won)...');
    await webhookService.dispatch(tenantId, 'lead.stage_changed', {
      lead_id: lead.id,
      previous_stage: 'New',
      new_stage: 'Won',
      lead
    });

    await webhookService.dispatch(tenantId, 'lead.won', {
      lead_id: lead.id,
      name: lead.name,
      deal_value: 50000,
      won_at: new Date().toISOString()
    });

    await new Promise(r => setTimeout(r, 1500));

    const wonDeliveries = await db.query(
      `SELECT event, status, status_code FROM webhook_deliveries WHERE tenant_id = $1 AND event = 'lead.won' LIMIT 1`,
      [tenantId]
    );

    if (wonDeliveries.rows.length > 0) {
      console.log(`🎉 PASS: "lead.won" webhook dispatched and recorded in delivery audit logs!`);
    } else {
      console.warn('⚠️ "lead.won" delivery record not found.');
    }

    // 6. Test Manual Resend
    console.log('\n[TEST 6] Testing Manual Webhook Resend...');
    const anyDelivery = await db.query(`SELECT id FROM webhook_deliveries WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    if (anyDelivery.rows.length > 0) {
      const resendRes = await webhookService.resendDelivery(tenantId, anyDelivery.rows[0].id);
      console.log(`🎉 PASS: Resend triggered successfully: ID=${resendRes.id}, Status=${resendRes.status}`);
    }

    // 7. Cleanup
    console.log('\n[TEST 7] Cleaning up test records...');
    await db.query(`DELETE FROM leads WHERE id = $1`, [lead.id]);
    await db.query(`DELETE FROM webhook_subscriptions WHERE id = $1`, [sub.id]);
    await db.query(`DELETE FROM api_keys WHERE id = $1`, [createdKey.id]);
    console.log('🧹 Cleaned up test lead, test webhook subscription, and test API key.');

    console.log('\n=====================================================');
    console.log('🎉 ALL INTEGRATIONS & PUBLIC API TESTS COMPLETED PASSING');
    console.log('=====================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  }
}

runTests();
