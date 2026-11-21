const express = require('express');
const router = express.Router();
const aiAgentService = require('../services/aiAgentService');
const { authenticateToken } = require('../middleware/authMiddleware');

// AI Copilot Chat Endpoint (Handles Natural Language Instructions)
router.post('/chat', authenticateToken, async (req, res) => {
  const { prompt, context } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, message: 'A prompt message is required.' });
  }

  try {
    const response = await aiAgentService.processCommand(prompt, req.tenantId, req.user.id, context || {});
    res.json({ success: true, ...response });
  } catch (err) {
    console.error('AI Copilot error:', err);
    res.status(500).json({ success: false, message: 'Failed to process AI command.' });
  }
});

// Quick Suggested Prompts
router.get('/suggestions', authenticateToken, (req, res) => {
  res.json({
    success: true,
    suggestions: [
      { text: 'Hot leads dikhao', description: 'Opens hot prospects requiring priority attention' },
      { text: 'Find Interior Designers on Google Maps', description: 'Scrapes fresh B2B leads via Google Maps' },
      { text: 'Rahul ko call karne ka task banao kal 3 baje', description: 'Schedules a follow-up call task' },
      { text: 'Aaj ka total revenue aur calls summary batao', description: 'Fetches today\'s KPI metrics' },
      { text: 'Open Sales Pipeline', description: 'Opens drag-and-drop Kanban board' },
    ],
  });
});

module.exports = router;
