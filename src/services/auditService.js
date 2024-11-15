const EventEmitter = require('events');
const mongoose = require('mongoose');

// Define audit log schema
const auditSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'transaction',
            'user',
            'admin',
            'security',
            'system',
            'game'
        ]
    },
    action: {
        type: String,
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    metadata: {
        ip: String,
        userAgent: String,
        location: {
            country: String,
            city: String,
            coordinates: {
                type: [Number],
                index: '2dsphere'
            }
        }
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'error', 'critical'],
        default: 'info'
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Create model
const AuditLog = mongoose.model('AuditLog', auditSchema);

class AuditService extends EventEmitter {
    constructor() {
        super();
        this.config = {
            retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
            batchSize: 100,
            severityThresholds: {
                transaction: {
                    amount: {
                        BTC: 1,
                        ETH: 10,
                        USDT: 10000,
                        USDC: 10000,
                        MATIC: 10000
                    }
                },
                failureRate: 0.1,
                loginAttempts: 5,
                adminActions: ['delete', 'modify', 'suspend']
            }
        };

        this.setupCleanup();
        this.setupEventListeners();
    }

    setupCleanup() {
        // Cleanup old audit logs daily
        setInterval(async () => {
            try {
                const cutoff = new Date(Date.now() - this.config.retentionPeriod);
                await AuditLog.deleteMany({ timestamp: { $lt: cutoff } });
            } catch (error) {
                console.error('Audit log cleanup error:', error);
            }
        }, 24 * 60 * 60 * 1000);
    }

    setupEventListeners() {
        // Transaction events
        this.on('transaction:created', this.logTransaction.bind(this));
        this.on('transaction:updated', this.logTransaction.bind(this));
        this.on('transaction:failed', this.logTransaction.bind(this));

        // User events
        this.on('user:login', this.logUserAction.bind(this));
        this.on('user:logout', this.logUserAction.bind(this));
        this.on('user:created', this.logUserAction.bind(this));
        this.on('user:updated', this.logUserAction.bind(this));

        // Admin events
        this.on('admin:action', this.logAdminAction.bind(this));

        // Security events
        this.on('security:alert', this.logSecurityEvent.bind(this));
        this.on('security:breach', this.logSecurityEvent.bind(this));

        // System events
        this.on('system:error', this.logSystemEvent.bind(this));
        this.on('system:warning', this.logSystemEvent.bind(this));

        // Game events
        this.on('game:started', this.logGameEvent.bind(this));
        this.on('game:ended', this.logGameEvent.bind(this));
        this.on('game:jackpot', this.logGameEvent.bind(this));
    }

    async logTransaction(data) {
        const { userId, type, amount, currency, status } = data;
        
        // Determine severity based on amount
        let severity = 'info';
        if (amount >= this.config.severityThresholds.transaction.amount[currency]) {
            severity = 'warning';
        }
        if (status === 'failed') {
            severity = 'error';
        }

        await this.createLog({
            type: 'transaction',
            action: type,
            userId,
            data,
            severity
        });
    }

    async logUserAction(data) {
        const { userId, action, metadata } = data;
        
        // Determine severity
        let severity = 'info';
        if (action === 'login_failed') {
            const failedAttempts = await this.getRecentFailedLogins(userId);
            if (failedAttempts >= this.config.severityThresholds.loginAttempts) {
                severity = 'warning';
            }
        }

        await this.createLog({
            type: 'user',
            action,
            userId,
            data,
            metadata,
            severity
        });
    }

    async logAdminAction(data) {
        const { adminId, action, targetId, changes } = data;
        
        // Determine severity based on action
        let severity = 'info';
        if (this.config.severityThresholds.adminActions.includes(action)) {
            severity = 'warning';
        }

        await this.createLog({
            type: 'admin',
            action,
            adminId,
            userId: targetId,
            data: { changes },
            severity
        });
    }

    async logSecurityEvent(data) {
        const { type, source, details } = data;
        
        // Security events are always high severity
        const severity = type === 'breach' ? 'critical' : 'warning';

        await this.createLog({
            type: 'security',
            action: type,
            data: { source, details },
            severity
        });
    }

    async logSystemEvent(data) {
        const { level, message, stack } = data;
        
        await this.createLog({
            type: 'system',
            action: level,
            data: { message, stack },
            severity: level
        });
    }

    async logGameEvent(data) {
        const { userId, gameId, action, result } = data;
        
        // Determine severity based on result
        let severity = 'info';
        if (action === 'jackpot') {
            severity = 'warning';
        }

        await this.createLog({
            type: 'game',
            action,
            userId,
            data: { gameId, result },
            severity
        });
    }

    async createLog(logData) {
        try {
            const log = new AuditLog(logData);
            await log.save();

            // Emit event for real-time monitoring
            this.emit('log:created', log);

            return log;
        } catch (error) {
            console.error('Audit log creation error:', error);
            throw error;
        }
    }

    // Query Methods

    async getRecentFailedLogins(userId) {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000); // Last 30 minutes
        const count = await AuditLog.countDocuments({
            type: 'user',
            action: 'login_failed',
            userId,
            timestamp: { $gt: cutoff }
        });
        return count;
    }

    async searchLogs(query) {
        const {
            type,
            action,
            userId,
            adminId,
            severity,
            startDate,
            endDate,
            limit = 100,
            skip = 0
        } = query;

        const filter = {};

        if (type) filter.type = type;
        if (action) filter.action = action;
        if (userId) filter.userId = userId;
        if (adminId) filter.adminId = adminId;
        if (severity) filter.severity = severity;
        if (startDate || endDate) {
            filter.timestamp = {};
            if (startDate) filter.timestamp.$gte = new Date(startDate);
            if (endDate) filter.timestamp.$lte = new Date(endDate);
        }

        const logs = await AuditLog.find(filter)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'username')
            .populate('adminId', 'username');

        const total = await AuditLog.countDocuments(filter);

        return {
            logs,
            total,
            page: Math.floor(skip / limit) + 1,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getAggregatedStats(query) {
        const {
            type,
            startDate,
            endDate,
            groupBy = 'day'
        } = query;

        const match = {};
        if (type) match.type = type;
        if (startDate || endDate) {
            match.timestamp = {};
            if (startDate) match.timestamp.$gte = new Date(startDate);
            if (endDate) match.timestamp.$lte = new Date(endDate);
        }

        const groupByFormat = {
            hour: { $hour: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            month: { $month: '$timestamp' },
            year: { $year: '$timestamp' }
        };

        const result = await AuditLog.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        period: groupByFormat[groupBy],
                        severity: '$severity'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: '$_id.period',
                    stats: {
                        $push: {
                            severity: '$_id.severity',
                            count: '$count'
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return result;
    }

    async getUserActivity(userId, query = {}) {
        const { startDate, endDate, type, limit = 50 } = query;

        const match = { userId };
        if (type) match.type = type;
        if (startDate || endDate) {
            match.timestamp = {};
            if (startDate) match.timestamp.$gte = new Date(startDate);
            if (endDate) match.timestamp.$lte = new Date(endDate);
        }

        return await AuditLog.find(match)
            .sort({ timestamp: -1 })
            .limit(limit);
    }

    async getSecurityEvents(query = {}) {
        const { severity, startDate, endDate, limit = 50 } = query;

        const match = { type: 'security' };
        if (severity) match.severity = severity;
        if (startDate || endDate) {
            match.timestamp = {};
            if (startDate) match.timestamp.$gte = new Date(startDate);
            if (endDate) match.timestamp.$lte = new Date(endDate);
        }

        return await AuditLog.find(match)
            .sort({ timestamp: -1 })
            .limit(limit);
    }

    async getAdminActions(query = {}) {
        const { adminId, action, startDate, endDate, limit = 50 } = query;

        const match = { type: 'admin' };
        if (adminId) match.adminId = adminId;
        if (action) match.action = action;
        if (startDate || endDate) {
            match.timestamp = {};
            if (startDate) match.timestamp.$gte = new Date(startDate);
            if (endDate) match.timestamp.$lte = new Date(endDate);
        }

        return await AuditLog.find(match)
            .sort({ timestamp: -1 })
            .limit(limit)
            .populate('adminId', 'username')
            .populate('userId', 'username');
    }
}

module.exports = new AuditService();
