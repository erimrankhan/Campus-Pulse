const express = require('express');
const path = require('path');
const helmet = require('helmet');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// Validate and normalize environment configuration
const PORT = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();

// Security middleware - HTTP security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:']
      }
    }
  })
);

// Body and Cookie parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve frontend static assets from public/ directory
app.use(express.static(PUBLIC_DIR));

// Public API Routes
const healthRoutes = require('./routes/health.routes');
app.use('/api', healthRoutes);

// Authentication API Routes
const authRoutes = require('./routes/auth.routes');
app.use('/api/auth', authRoutes);

// Smart Input API Routes (Module 3)
const noticeRoutes = require('./routes/notice.routes');
app.use('/api/notices', noticeRoutes);

// AI Extraction API Routes (Module 4)
const extractionRoutes = require('./routes/extraction.routes');
app.use('/api/extract', extractionRoutes);

// Extracted Information Verification API Routes (Module 5)
const verificationRoutes = require('./routes/verification.routes');
app.use('/api/verify', verificationRoutes);
app.use('/api/notices/:id/verify', (req, res, next) => {
  req.url = `/${req.params.id}`;
  verificationRoutes(req, res, next);
});

// Organized View — Verified Notices API Routes (Module 6)
const organizedRoutes = require('./routes/organized.routes');
app.use('/api/notices/verified', organizedRoutes);

// Calendar — Verified Events API Routes (Module 7)
const calendarRoutes = require('./routes/calendar.routes');
app.use('/api/calendar', calendarRoutes);

// Protected Sample API Route (Demonstrates backend access restriction)
const { requireAuth } = require('./middleware/auth.middleware');
app.get('/api/protected-access', requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authorized MIT Moradabad student access verified',
    student: req.student,
    serverTime: new Date().toISOString()
  });
});

// 404 Handler for undefined API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint '${req.method} ${req.originalUrl}' does not exist`,
    status: 404
  });
});

// Fallback to index.html for frontend navigation
app.use((req, res, next) => {
  if (req.method === 'GET') {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }
  next();
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || 500;
  const isProduction = NODE_ENV === 'production';

  res.status(statusCode).json({
    error: statusCode === 404 ? 'Not Found' : 'Internal Server Error',
    message: isProduction && statusCode === 500 ? 'An unexpected error occurred' : err.message || 'Server error',
    status: statusCode
  });
});

// Start server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🏛️  Campus Pulse — MIT Moradabad (Auth Active)`);
    console.log(`📡 Server active at: http://localhost:${PORT}`);
    console.log(`🩺 Health check:    http://localhost:${PORT}/api/health`);
    console.log(`🔒 Auth endpoint:   http://localhost:${PORT}/api/auth/login`);
    console.log(`⚙️  Environment:     ${NODE_ENV}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
