const User = require('../models/user');
const cryptoService = require('../services/cryptoService');
const transactionMonitor = require('../services/transactionMonitor');
const socketService = require('../services/socketService');
const { verifyAdmin } = require('../middleware/auth');

class AdminController {
    constructor() {
        this.stats = {
            hourlyVolume: new Map(),
            activeUsers: new Set(),
            pendingTransactions: new Map(),
            networkStats: new Map(),
            alerts: new Map()
        };

        this.setupStatsTracking();
    }

    setupStatsTracking() {
        // Track active users
        socketService.on('user:connected', (userId) => {
            this.stats.activeUsers.add(userId);
            this.broadcastActiveUsers();
        });

        socketService.on('user:disconnected', (userId) => {
            this.stats.activeUsers.delete(userId);
            this.broadcastActiveUsers();
        });

        // Track transactions
        cryptoService.on('deposit:created', this.handleNewTransaction.bind(this));
        cryptoService.on('withdrawal:initiated', this.handleNewTransaction.bind(this));
        cryptoService.on('deposit:success', this.handleSuccessfulTransaction.bind(this));
        cryptoService.on('withdrawal:success', this.handleSuccessfulTransaction.bind(this));
        cryptoService.on('deposit:failed', this.handleFailedTransaction.bind(this));
        cryptoService.on('withdrawal:failed', this.handleFailedTransaction.bind(this));

        // Track alerts
        transactionMonitor.on('alert:large_transaction', this.handleAlert.bind(this));
        transactionMonitor.on('alert:long_pending', this.handleAlert.bind(this));
        transactionMonitor.on('alert:high_failure_rate', this.handleAlert.bind(this));
        transactionMonitor.on('alert:retry_failed', this.handleAlert.bind(this));
    }

    // API Routes

    async getStats(req, res) {
        try {
            const stats = await this.generateStats();
            res.json(stats);
        } catch (error) {
            console.error('Stats generation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to generate stats'
            });
        }
    }

    async getTransactions(req, res) {
        try {
            const { type, currency, status, limit = 100 } = req.query;
            const transactions = await this.fetchTransactions(type, currency, status, limit);
            res.json(transactions);
        } catch (error) {
            console.error('Transaction fetch error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch transactions'
            });
        }
    }

    async getAlerts(req, res) {
        try {
            const { type, status, limit = 50 } = req.query;
            const alerts = await this.fetchAlerts(type, status, limit);
            res.json(alerts);
        } catch (error) {
            console.error('Alerts fetch error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch alerts'
            });
        }
    }

    async retryTransaction(req, res) {
        try {
            const { txId } = req.params;
            await cryptoService.retryTransaction(txId);
            res.json({ success: true });
        } catch (error) {
            console.error('Transaction retry error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retry transaction'
            });
        }
    }

    async cancelTransaction(req, res) {
        try {
            const { txId } = req.params;
            await cryptoService.cancelTransaction(txId);
            res.json({ success: true });
        } catch (error) {
            console.error('Transaction cancellation error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to cancel transaction'
            });
        }
    }

    async resolveAlert(req, res) {
        try {
            const { alertId } = req.params;
            await this.markAlertResolved(alertId);
            res.json({ success: true });
        } catch (error) {
            console.error('Alert resolution error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to resolve alert'
            });
        }
    }

    async getUserStats(req, res) {
        try {
            const { userId } = req.params;
            const stats = await this.generateUserStats(userId);
            res.json(stats);
        } catch (error) {
            console.error('User stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user stats'
            });
        }
    }

    // Helper Methods

    async generateStats() {
        const monitorStats = transactionMonitor.getStats();
        const prices = cryptoService.getPrices();

        return {
            activeUsers: this.stats.activeUsers.size,
            pendingTransactions: monitorStats.pending,
            volume: {
                total: monitorStats.volume,
                hourly: Object.fromEntries(this.stats.hourlyVolume)
            },
            networkStats: monitorStats.networkStats,
            failureRates: monitorStats.failureRates,
            prices: Object.fromEntries(prices)
        };
    }

    async fetchTransactions(type, currency, status, limit) {
        let query = {};

        if (type) {
            query.type = type;
        }
        if (currency) {
            query.currency = currency;
        }
        if (status) {
            query.status = status;
        }

        return Array.from(cryptoService.pendingTransactions.values())
            .filter(tx => {
                return (!type || tx.type === type) &&
                       (!currency || tx.currency === currency) &&
                       (!status || tx.status === status);
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    async fetchAlerts(type, status, limit) {
        return Array.from(this.stats.alerts.values())
            .filter(alert => {
                return (!type || alert.type === type) &&
                       (!status || alert.status === status);
            })
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    async generateUserStats(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const transactions = await this.fetchUserTransactions(userId);
        const volume = this.calculateUserVolume(transactions);
        const failureRate = this.calculateUserFailureRate(transactions);

        return {
            userId: user._id,
            username: user.username,
            balance: user.tokens,
            transactions: {
                total: transactions.length,
                successful: transactions.filter(tx => tx.status === 'completed').length,
                failed: transactions.filter(tx => tx.status === 'failed').length,
                volume
            },
            stats: {
                failureRate,
                avgTransactionSize: volume / transactions.length || 0,
                lastActive: user.lastActive
            }
        };
    }

    // Event Handlers

    handleNewTransaction(data) {
        const { txId, type, amount, currency, network } = data;
        
        // Update pending transactions
        this.stats.pendingTransactions.set(txId, {
            type,
            amount,
            currency,
            network,
            timestamp: Date.now()
        });

        // Update hourly volume
        const hour = new Date().getHours();
        if (!this.stats.hourlyVolume.has(hour)) {
            this.stats.hourlyVolume.set(hour, {
                deposits: 0,
                withdrawals: 0
            });
        }
        const hourlyStats = this.stats.hourlyVolume.get(hour);
        hourlyStats[type === 'deposit' ? 'deposits' : 'withdrawals'] += amount;

        // Broadcast update
        this.broadcastTransaction(data);
    }

    handleSuccessfulTransaction(data) {
        const { txId } = data;
        this.stats.pendingTransactions.delete(txId);
        this.broadcastTransaction(data);
    }

    handleFailedTransaction(data) {
        const { txId } = data;
        this.stats.pendingTransactions.delete(txId);
        this.broadcastTransaction(data);
    }

    handleAlert(data) {
        const alertId = `${data.type}_${Date.now()}`;
        this.stats.alerts.set(alertId, {
            id: alertId,
            ...data,
            timestamp: Date.now(),
            status: 'active'
        });

        this.broadcastAlert(data);
    }

    async markAlertResolved(alertId) {
        const alert = this.stats.alerts.get(alertId);
        if (alert) {
            alert.status = 'resolved';
            alert.resolvedAt = Date.now();
            this.broadcastAlert(alert);
        }
    }

    // Broadcasting

    broadcastTransaction(data) {
        socketService.broadcast('admin:transaction', data);
    }

    broadcastAlert(data) {
        socketService.broadcast('admin:alert', data);
    }

    broadcastActiveUsers() {
        socketService.broadcast('admin:active_users', this.stats.activeUsers.size);
    }
}

module.exports = new AdminController();
