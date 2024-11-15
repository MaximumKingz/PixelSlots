const EventEmitter = require('events');
const cryptoService = require('./cryptoService');
const User = require('../models/user');

class TransactionMonitor extends EventEmitter {
    constructor() {
        super();
        this.config = {
            checkInterval: 5 * 60 * 1000, // 5 minutes
            maxRetries: 3,
            retryDelay: 30 * 1000, // 30 seconds
            alertThresholds: {
                pendingTime: 2 * 60 * 60 * 1000, // 2 hours
                failureRate: 0.1, // 10%
                largeAmount: {
                    BTC: 1,
                    ETH: 10,
                    USDT: 10000,
                    USDC: 10000,
                    MATIC: 10000
                }
            }
        };

        this.stats = {
            totalTransactions: 0,
            successfulTransactions: 0,
            failedTransactions: 0,
            pendingTransactions: new Map(),
            networkStats: new Map(),
            hourlyVolume: new Map(),
            failureRates: new Map()
        };

        this.setupMonitoring();
        this.setupStatsReset();
    }

    setupMonitoring() {
        // Monitor transactions
        setInterval(() => this.checkPendingTransactions(), this.config.checkInterval);

        // Listen for crypto service events
        cryptoService.on('deposit:created', this.trackNewTransaction.bind(this));
        cryptoService.on('withdrawal:initiated', this.trackNewTransaction.bind(this));
        cryptoService.on('deposit:success', this.handleSuccessfulTransaction.bind(this));
        cryptoService.on('withdrawal:success', this.handleSuccessfulTransaction.bind(this));
        cryptoService.on('deposit:failed', this.handleFailedTransaction.bind(this));
        cryptoService.on('withdrawal:failed', this.handleFailedTransaction.bind(this));
    }

    setupStatsReset() {
        // Reset hourly stats
        setInterval(() => {
            const now = new Date();
            const hour = now.getHours();
            this.hourlyVolume.set(hour, {
                deposits: 0,
                withdrawals: 0
            });
        }, 60 * 60 * 1000);

        // Reset daily stats at midnight
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                this.resetDailyStats();
            }
        }, 60 * 1000);
    }

    trackNewTransaction(data) {
        const { txId, type, currency, network, amount } = data;
        
        // Update total transactions count
        this.stats.totalTransactions++;

        // Track pending transaction
        this.stats.pendingTransactions.set(txId, {
            type,
            currency,
            network,
            amount,
            startTime: Date.now(),
            retries: 0
        });

        // Update network stats
        if (!this.stats.networkStats.has(network)) {
            this.stats.networkStats.set(network, {
                total: 0,
                successful: 0,
                failed: 0,
                volume: 0
            });
        }
        const networkStats = this.stats.networkStats.get(network);
        networkStats.total++;
        networkStats.volume += amount;

        // Check for large transactions
        if (amount >= this.config.alertThresholds.largeAmount[currency]) {
            this.emit('alert:large_transaction', {
                txId,
                type,
                currency,
                network,
                amount
            });
        }

        // Update hourly volume
        const hour = new Date().getHours();
        if (!this.hourlyVolume.has(hour)) {
            this.hourlyVolume.set(hour, {
                deposits: 0,
                withdrawals: 0
            });
        }
        const hourlyStats = this.hourlyVolume.get(hour);
        hourlyStats[type === 'deposit' ? 'deposits' : 'withdrawals'] += amount;
    }

    async checkPendingTransactions() {
        const now = Date.now();
        const pendingTxs = Array.from(this.stats.pendingTransactions.entries());

        for (const [txId, tx] of pendingTxs) {
            try {
                // Check transaction status
                const status = await cryptoService.checkTransactionStatus(txId);

                if (status === 'completed' || status === 'failed') {
                    this.stats.pendingTransactions.delete(txId);
                } else if (now - tx.startTime > this.config.alertThresholds.pendingTime) {
                    // Alert for long-pending transactions
                    this.emit('alert:long_pending', {
                        txId,
                        type: tx.type,
                        currency: tx.currency,
                        network: tx.network,
                        amount: tx.amount,
                        pendingTime: now - tx.startTime
                    });

                    // Retry if needed
                    if (tx.retries < this.config.maxRetries) {
                        setTimeout(() => {
                            tx.retries++;
                            this.retryTransaction(txId, tx);
                        }, this.config.retryDelay);
                    }
                }
            } catch (error) {
                console.error('Transaction check error:', error);
            }
        }

        // Update failure rates
        this.updateFailureRates();
    }

    async retryTransaction(txId, tx) {
        try {
            if (tx.type === 'withdrawal') {
                // For withdrawals, we might need to resubmit
                await cryptoService.retryWithdrawal(txId);
            }
            // For deposits, we just need to recheck
            await cryptoService.checkTransactionStatus(txId);
        } catch (error) {
            console.error('Transaction retry error:', error);
            this.emit('alert:retry_failed', {
                txId,
                type: tx.type,
                error: error.message
            });
        }
    }

    handleSuccessfulTransaction(data) {
        const { txId, type, network } = data;
        
        // Update success count
        this.stats.successfulTransactions++;

        // Update network stats
        const networkStats = this.stats.networkStats.get(network);
        if (networkStats) {
            networkStats.successful++;
        }

        // Remove from pending
        this.stats.pendingTransactions.delete(txId);
    }

    handleFailedTransaction(data) {
        const { txId, type, network, error } = data;
        
        // Update failure count
        this.stats.failedTransactions++;

        // Update network stats
        const networkStats = this.stats.networkStats.get(network);
        if (networkStats) {
            networkStats.failed++;
        }

        // Remove from pending
        this.stats.pendingTransactions.delete(txId);

        // Emit alert for failed transaction
        this.emit('alert:transaction_failed', {
            txId,
            type,
            network,
            error
        });
    }

    updateFailureRates() {
        for (const [network, stats] of this.stats.networkStats) {
            const failureRate = stats.failed / stats.total;
            this.stats.failureRates.set(network, failureRate);

            // Alert if failure rate is too high
            if (failureRate > this.config.alertThresholds.failureRate) {
                this.emit('alert:high_failure_rate', {
                    network,
                    failureRate,
                    stats
                });
            }
        }
    }

    resetDailyStats() {
        // Reset network stats
        for (const stats of this.stats.networkStats.values()) {
            stats.total = 0;
            stats.successful = 0;
            stats.failed = 0;
            stats.volume = 0;
        }

        // Reset failure rates
        this.stats.failureRates.clear();

        // Reset hourly volume
        this.hourlyVolume.clear();

        // Keep pending transactions
        this.stats.totalTransactions = 0;
        this.stats.successfulTransactions = 0;
        this.stats.failedTransactions = 0;
    }

    getStats() {
        return {
            total: this.stats.totalTransactions,
            successful: this.stats.successfulTransactions,
            failed: this.stats.failedTransactions,
            pending: this.stats.pendingTransactions.size,
            networkStats: Object.fromEntries(this.stats.networkStats),
            failureRates: Object.fromEntries(this.stats.failureRates),
            hourlyVolume: Object.fromEntries(this.hourlyVolume)
        };
    }

    getTransactionDetails(txId) {
        return this.stats.pendingTransactions.get(txId);
    }

    getNetworkStats(network) {
        return this.stats.networkStats.get(network);
    }

    getHourlyVolume(hour) {
        return this.hourlyVolume.get(hour);
    }
}

module.exports = new TransactionMonitor();
