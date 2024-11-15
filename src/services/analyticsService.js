const mongoose = require('mongoose');
const cryptoService = require('./cryptoService');
const auditService = require('./auditService');

class AnalyticsService {
    constructor() {
        this.stats = {
            transactions: new Map(),
            users: new Map(),
            games: new Map(),
            revenue: new Map()
        };

        this.setupEventListeners();
        this.setupPeriodicAggregation();
    }

    setupEventListeners() {
        // Transaction events
        cryptoService.on('deposit:success', this.handleTransaction.bind(this));
        cryptoService.on('withdrawal:success', this.handleTransaction.bind(this));

        // Game events
        auditService.on('game:ended', this.handleGameEvent.bind(this));
        auditService.on('game:jackpot', this.handleJackpotEvent.bind(this));

        // User events
        auditService.on('user:created', this.handleUserEvent.bind(this));
        auditService.on('user:login', this.handleUserEvent.bind(this));
    }

    setupPeriodicAggregation() {
        // Aggregate stats every hour
        setInterval(() => {
            this.aggregateHourlyStats();
        }, 60 * 60 * 1000);

        // Aggregate daily stats at midnight
        setInterval(() => {
            if (new Date().getHours() === 0) {
                this.aggregateDailyStats();
            }
        }, 60 * 60 * 1000);
    }

    // Event Handlers

    async handleTransaction(data) {
        const { userId, type, amount, currency } = data;
        
        // Update user stats
        const userStats = this.stats.users.get(userId) || this.createUserStats();
        if (type === 'deposit') {
            userStats.deposits.total++;
            userStats.deposits.volume += amount;
        } else {
            userStats.withdrawals.total++;
            userStats.withdrawals.volume += amount;
        }
        this.stats.users.set(userId, userStats);

        // Update transaction stats
        const txStats = this.stats.transactions.get(currency) || this.createTransactionStats();
        txStats[type].total++;
        txStats[type].volume += amount;
        this.stats.transactions.set(currency, txStats);
    }

    async handleGameEvent(data) {
        const { userId, gameId, result } = data;
        
        // Update user stats
        const userStats = this.stats.users.get(userId) || this.createUserStats();
        userStats.games.played++;
        userStats.games.wagered += result.wager;
        userStats.games.won += result.payout;
        if (result.payout > userStats.games.biggestWin) {
            userStats.games.biggestWin = result.payout;
        }
        this.stats.users.set(userId, userStats);

        // Update game stats
        const gameStats = this.stats.games.get(gameId) || this.createGameStats();
        gameStats.played++;
        gameStats.wagered += result.wager;
        gameStats.payout += result.payout;
        this.stats.games.set(gameId, gameStats);

        // Update revenue stats
        const revenueStats = this.stats.revenue.get('total') || this.createRevenueStats();
        revenueStats.wager += result.wager;
        revenueStats.payout += result.payout;
        revenueStats.profit = revenueStats.wager - revenueStats.payout;
        this.stats.revenue.set('total', revenueStats);
    }

    async handleJackpotEvent(data) {
        const { userId, amount } = data;
        
        // Update jackpot stats
        const jackpotStats = this.stats.games.get('jackpot') || this.createJackpotStats();
        jackpotStats.total++;
        jackpotStats.volume += amount;
        jackpotStats.winners.push({ userId, amount, timestamp: Date.now() });
        this.stats.games.set('jackpot', jackpotStats);
    }

    async handleUserEvent(data) {
        const { userId, action } = data;
        
        // Update user stats
        const userStats = this.stats.users.get(userId) || this.createUserStats();
        if (action === 'login') {
            userStats.logins++;
        }
        this.stats.users.set(userId, userStats);
    }

    // Stats Creation

    createUserStats() {
        return {
            deposits: { total: 0, volume: 0 },
            withdrawals: { total: 0, volume: 0 },
            games: {
                played: 0,
                wagered: 0,
                won: 0,
                biggestWin: 0
            },
            logins: 0,
            lastActive: Date.now()
        };
    }

    createTransactionStats() {
        return {
            deposits: { total: 0, volume: 0 },
            withdrawals: { total: 0, volume: 0 }
        };
    }

    createGameStats() {
        return {
            played: 0,
            wagered: 0,
            payout: 0,
            jackpots: 0
        };
    }

    createJackpotStats() {
        return {
            total: 0,
            volume: 0,
            winners: []
        };
    }

    createRevenueStats() {
        return {
            wager: 0,
            payout: 0,
            profit: 0
        };
    }

    // Aggregation Methods

    async aggregateHourlyStats() {
        const hour = new Date().getHours();
        
        // Aggregate transaction stats
        const txStats = {};
        this.stats.transactions.forEach((stats, currency) => {
            txStats[currency] = {
                deposits: stats.deposits,
                withdrawals: stats.withdrawals
            };
        });

        // Aggregate game stats
        const gameStats = {};
        this.stats.games.forEach((stats, gameId) => {
            gameStats[gameId] = {
                played: stats.played,
                wagered: stats.wagered,
                payout: stats.payout
            };
        });

        // Aggregate revenue stats
        const revenueStats = this.stats.revenue.get('total') || this.createRevenueStats();

        // Save hourly stats
        await this.saveHourlyStats(hour, {
            transactions: txStats,
            games: gameStats,
            revenue: revenueStats
        });

        // Reset counters
        this.resetStats();
    }

    async aggregateDailyStats() {
        const date = new Date().toISOString().split('T')[0];
        
        // Get hourly stats for the day
        const hourlyStats = await this.getHourlyStats(date);

        // Aggregate daily totals
        const dailyStats = this.aggregateStats(hourlyStats);

        // Save daily stats
        await this.saveDailyStats(date, dailyStats);
    }

    async saveHourlyStats(hour, stats) {
        // Implementation depends on your database schema
        // This is just a placeholder
        console.log(`Saving hourly stats for hour ${hour}:`, stats);
    }

    async saveDailyStats(date, stats) {
        // Implementation depends on your database schema
        // This is just a placeholder
        console.log(`Saving daily stats for date ${date}:`, stats);
    }

    async getHourlyStats(date) {
        // Implementation depends on your database schema
        // This is just a placeholder
        return [];
    }

    aggregateStats(hourlyStats) {
        // Aggregate hourly stats into daily totals
        const daily = {
            transactions: {},
            games: {},
            revenue: this.createRevenueStats()
        };

        hourlyStats.forEach(hour => {
            // Aggregate transactions
            Object.entries(hour.transactions).forEach(([currency, stats]) => {
                if (!daily.transactions[currency]) {
                    daily.transactions[currency] = this.createTransactionStats();
                }
                daily.transactions[currency].deposits.total += stats.deposits.total;
                daily.transactions[currency].deposits.volume += stats.deposits.volume;
                daily.transactions[currency].withdrawals.total += stats.withdrawals.total;
                daily.transactions[currency].withdrawals.volume += stats.withdrawals.volume;
            });

            // Aggregate games
            Object.entries(hour.games).forEach(([gameId, stats]) => {
                if (!daily.games[gameId]) {
                    daily.games[gameId] = this.createGameStats();
                }
                daily.games[gameId].played += stats.played;
                daily.games[gameId].wagered += stats.wagered;
                daily.games[gameId].payout += stats.payout;
            });

            // Aggregate revenue
            daily.revenue.wager += hour.revenue.wager;
            daily.revenue.payout += hour.revenue.payout;
            daily.revenue.profit += hour.revenue.profit;
        });

        return daily;
    }

    resetStats() {
        this.stats.transactions = new Map();
        this.stats.games = new Map();
        this.stats.revenue = new Map();
        // Don't reset user stats as they're cumulative
    }

    // Query Methods

    async getTransactionStats(query) {
        const { currency, type, startDate, endDate } = query;
        // Implementation depends on your database schema
        // This is just a placeholder
        return {};
    }

    async getGameStats(query) {
        const { gameId, startDate, endDate } = query;
        // Implementation depends on your database schema
        // This is just a placeholder
        return {};
    }

    async getUserStats(userId) {
        return this.stats.users.get(userId) || this.createUserStats();
    }

    async getRevenueStats(query) {
        const { startDate, endDate } = query;
        // Implementation depends on your database schema
        // This is just a placeholder
        return {};
    }

    async getJackpotStats() {
        return this.stats.games.get('jackpot') || this.createJackpotStats();
    }
}

module.exports = new AnalyticsService();
