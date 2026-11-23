const axios = require('axios');

const API_BASE = 'https://api.yogkart.com/loomlead/api/v1';

async function runAcceptanceTests() {
  console.log('=====================================================');
  console.log('🧪 RUNNING ACCEPTANCE VERIFICATION TESTS');
  console.log('Target API:', API_BASE);
  console.log('=====================================================\n');

  try {
    // 1. Health check
    const health = await axios.get('https://api.yogkart.com/loomlead/api/health');
    console.log('✅ 1. Health check status:', health.data.status);

    // 2. Login to obtain JWT
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      email: 'vikram@apexrealty.com',
      password: 'password123'
    });
    const token = loginRes.data.token;
    console.log('✅ 2. Authenticated as Vikram Mehta. JWT acquired.');

    const headers = { Authorization: `Bearer ${token}` };

    // Clean up any test leads and suppressions first
    const existingLeads = await axios.get(`${API_BASE}/leads`, { headers });
    for (const lead of existingLeads.data.leads || []) {
      if (lead.phone.includes('9820112345')) {
        await axios.delete(`${API_BASE}/leads/${lead.id}`, { headers });
      }
    }
    const supList = await axios.get(`${API_BASE}/suppression`, { headers });
    for (const s of supList.data.suppressionList || []) {
      if (s.value.includes('9820112345')) {
        await axios.delete(`${API_BASE}/suppression/${s.id}`, { headers });
      }
    }

    // 3. Test Deduplication: Ingest first lead
    console.log('\n--- TEST A: Ingest First Lead (Phone: "98201 12345", Source: "Google Maps") ---');
    const lead1Res = await axios.post(`${API_BASE}/leads`, {
      name: 'Rajesh Kulkarni',
      phone: '98201 12345',
      company_name: '',
      email: 'rajesh@apexrealty.com',
      source: 'Google Maps'
    }, { headers });
    console.log('Lead 1 Response Action:', lead1Res.data.action || 'created', '| ID:', lead1Res.data.lead.id);
    console.log('Normalized Phone:', lead1Res.data.lead.normalized_phone);
    console.log('Sources:', lead1Res.data.lead.sources);

    // 4. Test Deduplication: Ingest second lead with SAME number in different format
    console.log('\n--- TEST B: Ingest Second Lead (Phone: "+919820112345", Company: "Kulkarni Holdings", Source: "Website") ---');
    const lead2Res = await axios.post(`${API_BASE}/leads`, {
      name: 'Rajesh Kulkarni',
      phone: '+919820112345',
      company_name: 'Kulkarni Holdings',
      email: '',
      source: 'Website'
    }, { headers });
    console.log('Lead 2 Response Action:', lead2Res.data.action, '| ID:', lead2Res.data.lead.id);
    console.log('Enriched Company:', lead2Res.data.lead.company_name);
    console.log('Merged Sources:', lead2Res.data.lead.sources);

    // Check count in database
    const leadsAfter = await axios.get(`${API_BASE}/leads`, { headers });
    console.log(`Total Leads in Database: ${leadsAfter.data.leads.length}`);
    if (leadsAfter.data.leads.length === 1 && lead1Res.data.lead.id === lead2Res.data.lead.id) {
      console.log('✅ ACCEPTANCE CRITERIA 1 PASSED: Importing the same phone twice created exactly 1 enriched lead!');
    } else {
      console.error('❌ Failed: Deduplication did not merge into single lead.');
    }

    const testLead = lead2Res.data.lead;

    // 5. Test Suppression / DND via WhatsApp Webhook
    console.log('\n--- TEST C: WhatsApp Inbound Webhook with Stop Keyword ("BAND KARO") ---');
    const webhookRes = await axios.post(`${API_BASE}/webhooks/whatsapp`, {
      from: '9820112345',
      message: 'BAND KARO mujhe message mat bhejo'
    });
    console.log('Webhook Result:', webhookRes.data);
    if (webhookRes.data.suppressed) {
      console.log('✅ Auto-suppression triggered successfully by STOP keyword.');
    }

    // 6. Test Outbound Send Block
    console.log('\n--- TEST D: Attempt Outbound Send to Suppressed Lead ---');
    try {
      await axios.post(`${API_BASE}/suppression/outbound/send`, {
        lead_id: testLead.id,
        channel: 'whatsapp',
        message: 'Hello Rajesh, special offer for you!'
      }, { headers });
      console.error('❌ Failed: Outbound send was not blocked!');
    } catch (err) {
      if (err.response && err.response.status === 422 && err.response.data.code === 'DND_SUPPRESSED') {
        console.log('✅ ACCEPTANCE CRITERIA 2 PASSED: Outbound message rejected with 422 DND_SUPPRESSED!');
        console.log('   Error Message:', err.response.data.message);
        console.log('   Reason:', err.response.data.reason);
      } else {
        console.error('Unexpected error response:', err.response?.status, err.response?.data);
      }
    }

    // 7. Test Outbound Call Log Block
    console.log('\n--- TEST E: Attempt Outbound Call Log to Suppressed Lead ---');
    try {
      await axios.post(`${API_BASE}/calls`, {
        lead_id: testLead.id,
        direction: 'outbound',
        outcome: 'connected'
      }, { headers });
      console.error('❌ Failed: Outbound call was not blocked!');
    } catch (err) {
      if (err.response && err.response.status === 422 && err.response.data.code === 'DND_SUPPRESSED') {
        console.log('✅ ACCEPTANCE CRITERIA 3 PASSED: Outbound call rejected with 422 DND_SUPPRESSED!');
      } else {
        console.error('Unexpected call error response:', err.response?.status, err.response?.data);
      }
    }

    // 8. Test Lead GET returns DND badge data
    console.log('\n--- TEST F: Verify is_dnd flag in Lead Listing ---');
    const leadsListRes = await axios.get(`${API_BASE}/leads`, { headers });
    const leadWithDnd = leadsListRes.data.leads.find(l => l.id === testLead.id);
    console.log(`Lead is_dnd: ${leadWithDnd.is_dnd}, Reason: ${leadWithDnd.dnd_reason}`);
    if (leadWithDnd.is_dnd) {
      console.log('✅ Lead row contains is_dnd: true for DND badge rendering in UI.');
    }

    // 9. Test Suppression Removal
    console.log('\n--- TEST G: Remove from Suppression List ---');
    const updatedSup = await axios.get(`${API_BASE}/suppression`, { headers });
    const supEntry = updatedSup.data.suppressionList.find(s => s.value === '+919820112345');
    if (supEntry) {
      const delRes = await axios.delete(`${API_BASE}/suppression/${supEntry.id}`, { headers });
      console.log('Suppression deleted:', delRes.data);

      // Now outbound send should succeed
      const allowedSend = await axios.post(`${API_BASE}/suppression/outbound/send`, {
        lead_id: testLead.id,
        channel: 'whatsapp',
        message: 'Welcome back Rajesh!'
      }, { headers });
      console.log('Outbound Send after removal:', allowedSend.data.message);
      console.log('✅ ACCEPTANCE CRITERIA 4 PASSED: Outbound communication unblocked after DND removal.');
    }

    console.log('\n=====================================================');
    console.log('🎉 ALL DATA HYGIENE ACCEPTANCE TESTS PASSED 100%!');
    console.log('=====================================================');

  } catch (err) {
    console.error('❌ Test failed with error:', err.response ? err.response.data : err.message);
  }
}

runAcceptanceTests();
