// LoomLead Chrome Extension - Popup Controller
document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_API_URL = 'https://api.yogkart.com/loomlead/api/v1/public';

  const connectionBadge = document.getElementById('connectionBadge');
  const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');

  const sourceDomain = document.getElementById('sourceDomain');
  const rescanBtn = document.getElementById('rescanBtn');
  const leadForm = document.getElementById('leadForm');

  const leadName = document.getElementById('leadName');
  const companyName = document.getElementById('companyName');
  const leadCategory = document.getElementById('leadCategory');
  const leadPhone = document.getElementById('leadPhone');
  const leadEmail = document.getElementById('leadEmail');
  const leadWebsite = document.getElementById('leadWebsite');
  const leadStage = document.getElementById('leadStage');
  const budgetValue = document.getElementById('budgetValue');
  const leadNotes = document.getElementById('leadNotes');

  const submitBtn = document.getElementById('submitBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnText = document.getElementById('btnText');
  const resultCard = document.getElementById('resultCard');
  const resultMessage = document.getElementById('resultMessage');
  const resultDetails = document.getElementById('resultDetails');

  let activeCapturedData = null;

  // 1. Load saved API settings
  chrome.storage.sync.get(['loomlead_api_url', 'loomlead_api_key'], (res) => {
    const apiUrl = res.loomlead_api_url || DEFAULT_API_URL;
    const apiKey = res.loomlead_api_key || '';

    apiUrlInput.value = apiUrl;
    apiKeyInput.value = apiKey;

    if (apiKey && apiKey.startsWith('ll_live_')) {
      connectionBadge.textContent = 'Connected';
      connectionBadge.className = 'status-badge connected';
    } else {
      connectionBadge.textContent = 'API Key Needed';
      connectionBadge.className = 'status-badge disconnected';
      settingsPanel.classList.add('active');
    }

    // Scan current tab
    scanCurrentTab();
  });

  // 2. Toggle settings
  toggleSettingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('active');
  });

  // 3. Save settings
  saveSettingsBtn.addEventListener('click', () => {
    const url = apiUrlInput.value.trim() || DEFAULT_API_URL;
    const key = apiKeyInput.value.trim();

    if (!key.startsWith('ll_live_')) {
      alert('API Key must start with "ll_live_". Generate one in LoomLead CRM > Integrations.');
      return;
    }

    chrome.storage.sync.set({
      loomlead_api_url: url,
      loomlead_api_key: key
    }, () => {
      connectionBadge.textContent = 'Connected';
      connectionBadge.className = 'status-badge connected';
      settingsPanel.classList.remove('active');
    });
  });

  // 4. Rescan button
  rescanBtn.addEventListener('click', () => {
    scanCurrentTab();
  });

  // 5. Scan active browser tab
  function scanCurrentTab() {
    sourceDomain.textContent = 'Scanning active page...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sourceDomain.textContent = 'No active tab';
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab.url || activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://')) {
        sourceDomain.textContent = 'Internal browser page (cannot capture)';
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        files: ['content.js']
      }, (results) => {
        if (chrome.runtime.lastError || !results || !results[0] || !results[0].result) {
          sourceDomain.textContent = activeTab.title || 'Active Webpage';
          leadName.value = activeTab.title || '';
          leadWebsite.value = activeTab.url || '';
          return;
        }

        const data = results[0].result;
        activeCapturedData = data;

        sourceDomain.textContent = `${data.source} (${data.domain})`;
        leadName.value = data.name || data.title || '';
        companyName.value = data.company || '';
        leadCategory.value = data.category || '';
        leadPhone.value = data.phone || '';
        leadEmail.value = data.email || '';
        leadWebsite.value = data.url || '';
        leadNotes.value = data.notes || '';
      });
    });
  }

  // 6. Submit form to LoomLead Public API
  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiKey = apiKeyInput.value.trim();
    const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;

    if (!apiKey) {
      settingsPanel.classList.add('active');
      alert('Please enter your LoomLead API Key first.');
      return;
    }

    // Prepare payload
    const payload = {
      name: leadName.value.trim(),
      company_name: companyName.value.trim() || leadName.value.trim(),
      phone: leadPhone.value.trim() || null,
      email: leadEmail.value.trim() || null,
      category: leadCategory.value.trim() || 'Business & Commercial',
      website: leadWebsite.value.trim() || null,
      status: leadStage.value || 'New',
      budget_value: parseFloat(budgetValue.value) || 0,
      notes: leadNotes.value.trim() || null,
      source: `Chrome Extension (${activeCapturedData ? activeCapturedData.source : 'Web'})`
    };

    // UI loading state
    btnSpinner.style.display = 'inline-block';
    btnText.textContent = 'Saving Lead...';
    submitBtn.disabled = true;
    resultCard.style.display = 'none';

    try {
      const response = await fetch(`${apiUrl}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || `Server responded with ${response.status}`);
      }

      const lead = data.data;
      const isDuplicate = data.is_duplicate;
      const actionText = data.action === 'merged' ? 'Merged with Existing Lead' : 'New Lead Created';

      resultCard.className = 'result-card success';
      resultCard.style.display = 'block';
      resultMessage.innerHTML = `✅ ${actionText}!`;

      const scoreBucket = lead.score || 'Warm';
      const scoreClass = scoreBucket === 'Hot' ? 'score-hot' : (scoreBucket === 'Warm' ? 'score-warm' : 'score-cold');
      const scoreVal = lead.score_value !== undefined ? lead.score_value : 50;

      resultDetails.innerHTML = `
        <div><strong>Name:</strong> ${lead.name} (${lead.company_name})</div>
        <div>
          <strong>Score:</strong>
          <span class="score-tag ${scoreClass}">${scoreBucket} (${scoreVal}/100)</span>
          ${isDuplicate ? '<span style="color: #2563eb; margin-left: 4px;">• Deduplicated</span>' : ''}
        </div>
        <div style="margin-top: 6px;">
          <a href="https://loomlead-ec191.web.app/leads" target="_blank" style="color: #0284c7; text-decoration: underline; font-weight: 600;">
            Open Lead in LoomLead CRM &rarr;
          </a>
        </div>
      `;
    } catch (err) {
      resultCard.className = 'result-card error';
      resultCard.style.display = 'block';
      resultMessage.textContent = '❌ Failed to Save Lead';
      resultDetails.textContent = err.message;
    } finally {
      btnSpinner.style.display = 'none';
      btnText.textContent = 'Save to LoomLead CRM';
      submitBtn.disabled = false;
    }
  });
});
