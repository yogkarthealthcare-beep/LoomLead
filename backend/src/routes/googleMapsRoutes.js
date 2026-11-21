const express = require('express');
const router = express.Router();
const googleMapsService = require('../services/googleMapsService');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkPlanLimit } = require('../middleware/planGatingMiddleware');

// Get Trending Commercial Keywords for Niche Lead Scraper
router.get('/trending', authenticateToken, (req, res) => {
  const categories = googleMapsService.getTrendingKeywords();
  res.json({ success: true, categories });
});

// Search Places on Google Maps via Axios
router.post('/search', authenticateToken, async (req, res) => {
  const { query, location } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, message: 'Search keyword is required.' });
  }

  try {
    const result = await googleMapsService.searchPlaces(query, location, req.tenantId);
    res.json(result);
  } catch (err) {
    console.error('Google Maps Search error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1-Click Import Selected Places into CRM Leads
router.post('/import', authenticateToken, async (req, res) => {
  const { places, stage_id } = req.body;
  if (!Array.isArray(places) || places.length === 0) {
    return res.status(400).json({ success: false, message: 'Please select businesses to import.' });
  }

  try {
    const result = await googleMapsService.bulkImportToLeads(req.tenantId, req.user.id, places, stage_id);
    res.json({
      success: true,
      imported_count: result.count,
      leads: result.importedLeads,
      message: `Successfully imported ${result.count} new leads from Google Maps!`,
    });
  } catch (err) {
    console.error('Google Maps bulk import error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
