const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { authenticateToken } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const leadRoutes = require('./routes/leadRoutes');
const callLogRoutes = require('./routes/callLogRoutes');
const googleMapsRoutes = require('./routes/googleMapsRoutes');
const aiAgentRoutes = require('./routes/aiAgentRoutes');
const importExportRoutes = require('./routes/importExportRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const taskRoutes = require('./routes/taskRoutes');
const suppressionRoutes = require('./routes/suppressionRoutes');
const sequenceRoutes = require('./routes/sequenceRoutes');
const scoringRoutes = require('./routes/scoringRoutes');
const publicApiRoutes = require('./routes/publicApiRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const sequenceWorker = require('./services/sequenceWorker');
const webhookService = require('./services/webhookService');
const { getDashboardStats } = require('./controllers/dashboardController');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy (Nginx) for SSL & rate limiting
app.set('trust proxy', 1);

// Security & Middlewares
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter for API protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/', limiter);

// =====================================================================
// ROUTE REGISTRATIONS
// =====================================================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'UP', service: 'LoomLead CRM Backend', timestamp: new Date() });
});

// Auth Routes (Login, Register, Profile)
app.use('/api/v1/auth', authRoutes);

// Dashboard KPI & Chart Analytics
app.get('/api/v1/dashboard', authenticateToken, getDashboardStats);

// Leads Management
app.use('/api/v1/leads', leadRoutes);

// Call Logs & Tracking
app.use('/api/v1/calls', callLogRoutes);

// Tasks & Follow-ups
app.use('/api/v1/tasks', taskRoutes);

// Google Maps & Trending Keywords Lead Generator (Axios)
app.use('/api/v1/google-maps', googleMapsRoutes);

// In-App Autonomous AI Agent Copilot
app.use('/api/v1/ai-agent', aiAgentRoutes);

// Suppression / DND & Hygiene Management
app.use('/api/v1/suppression', suppressionRoutes);
app.use('/api/v1/webhooks', suppressionRoutes); // Convenience alias for webhooks (e.g. /api/v1/webhooks/whatsapp)

// Sequence (Drip) Outreach Engine
app.use('/api/v1/sequences', sequenceRoutes);

// Rule-Based Lead Scoring & Engagement Engine
app.use('/api/v1/scoring', scoringRoutes);

// Import & Export (PDF, Excel, Word, CSV)
app.use('/api/v1/import-export', importExportRoutes);

// Public REST API (v1) with API Key Authentication & Rate Limiting
const publicApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Public API rate limit exceeded (120 req/min).' },
});
app.use('/api/v1/public', publicApiLimiter, publicApiRoutes);

// Integrations (API Keys, Outgoing Webhooks, Delivery Logs)
app.use('/api/v1/integrations', integrationRoutes);

// Super Admin Platform Owner Portal
app.use('/api/v1/superadmin', superAdminRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected internal server error occurred.',
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 LoomLead CRM Backend API running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);

  // Start Background Sequence Drip Worker
  sequenceWorker.start();

  // Start Background Webhook Retry Worker (every 30 seconds)
  setInterval(() => {
    webhookService.processPendingRetries().catch(err => {
      console.error('[WebhookRetryWorker] Error:', err.message);
    });
  }, 30000);
});
