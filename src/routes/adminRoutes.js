const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyAdmin } = require('../middleware/auth');

// Apply admin verification middleware to all routes
router.use(verifyAdmin);

// Dashboard stats
router.get('/stats', adminController.getStats.bind(adminController));

// Transaction management
router.get('/transactions', adminController.getTransactions.bind(adminController));
router.post('/transactions/:txId/retry', adminController.retryTransaction.bind(adminController));
router.post('/transactions/:txId/cancel', adminController.cancelTransaction.bind(adminController));

// Alert management
router.get('/alerts', adminController.getAlerts.bind(adminController));
router.post('/alerts/:alertId/resolve', adminController.resolveAlert.bind(adminController));

// User management
router.get('/users/:userId/stats', adminController.getUserStats.bind(adminController));

module.exports = router;
