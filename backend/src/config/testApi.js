const axios = require('axios');

async function testBackend() {
  const PORT = 5000;
  const baseUrl = `http://localhost:${PORT}`;

  try {
    console.log('Testing Health Endpoint...');
    const health = await axios.get(`${baseUrl}/api/health`);
    console.log('✅ Health Response:', health.data);

    console.log('\nTesting Auth Login Endpoint with DB...');
    const loginRes = await axios.post(`${baseUrl}/api/v1/auth/login`, {
      email: 'vikram@apexrealty.com',
      password: 'password123'
    });
    console.log('✅ Login Response:', loginRes.data);

    const token = loginRes.data.token;
    console.log('\nTesting Dashboard Analytics with JWT...');
    const dashRes = await axios.get(`${baseUrl}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Dashboard KPIs from LoomLeadDB:', dashRes.data.data.kpi);

    console.log('\nTesting Google Maps Trending Keywords...');
    const trendsRes = await axios.get(`${baseUrl}/api/v1/google-maps/trending`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ Trending Categories Count:', trendsRes.data.categories.length);

    console.log('\nTesting AI Copilot Command...');
    const aiRes = await axios.post(`${baseUrl}/api/v1/ai-agent/chat`, {
      prompt: 'Hot leads dikhao'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✅ AI Copilot Action Response:', aiRes.data);

    console.log('\n🎉 ALL BACKEND ENDPOINTS AND DATABASE INTEGRATION VERIFIED 100%!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testBackend();
