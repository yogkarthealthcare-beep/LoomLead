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
const { getDashboardStats } = require('./controllers/dashboardController');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiter for API protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
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

// Import & Export (PDF, Excel, Word, CSV)
app.use('/api/v1/import-export', importExportRoutes);

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
});
