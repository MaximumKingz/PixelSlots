const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyAdmin } = require('../middleware/auth');

// Apply admin verification middleware to all routes
router.use(verifyAdmin);

// User Analytics
router.get('/users/:userId', analyticsController.getUserAnalytics.bind(analyticsController));

// Game Analytics
router.get('/games/:gameId', analyticsController.getGameAnalytics.bind(analyticsController));

// Financial Analytics
router.get('/financial', analyticsController.getFinancialAnalytics.bind(analyticsController));

// Performance Analytics
router.get('/performance', analyticsController.getPerformanceMetrics.bind(analyticsController));

// Feature Analytics
router.get('/features', analyticsController.getFeatureAnalytics.bind(analyticsController));

// Jackpot Analytics
router.get('/jackpots', analyticsController.getJackpotAnalytics.bind(analyticsController));

// User Behavior Analytics
router.get('/behavior', analyticsController.getUserBehaviorAnalytics.bind(analyticsController));

// Risk Analytics
router.get('/risk', analyticsController.getRiskAnalytics.bind(analyticsController));

module.exports = router;
