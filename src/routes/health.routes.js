const express = require('express');

const router = express.Router();

/**
 * GET /api/health
 * Public health-check endpoint reporting server operational status
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Campus Pulse API is operational',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

module.exports = router;

