const db = require('./dbService');
const auditService = require('./auditService');
const cryptoService = require('./cryptoService');

class AdvancedAnalytics {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Game events
        auditService.on('game:ended', this.handleGameRound.bind(this));
        auditService.on('game:jackpot', this.handleJackpot.bind(this));

        // User events
        auditService.on('user:login', this.handleUserSession.bind(this));
        auditService.on('user:logout', this.endUserSession.bind(this));

        // Transaction events
        cryptoService.on('deposit:success', this.handleTransaction.bind(this));
        cryptoService.on('withdrawal:success', this.handleTransaction.bind(this));
    }

    // Event Handlers

    async handleGameRound(data) {
        const { userId, gameId, bet, payout, symbols, paylines, features } = data;

        await db.transaction(async (connection) => {
            // Record game round
            const [roundResult] = await connection.execute(`
                INSERT INTO game_rounds (
                    user_id, game_id, timestamp, bet_amount, payout_amount,
                    currency, multiplier, symbols, paylines, features, session_id
                ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, (
                    SELECT id FROM user_sessions 
                    WHERE user_id = ? AND end_time IS NULL 
                    ORDER BY start_time DESC LIMIT 1
                ))
            `, [
                userId, gameId, bet.amount, payout.amount, bet.currency,
                payout.amount / bet.amount, JSON.stringify(symbols),
                JSON.stringify(paylines), JSON.stringify(features), userId
            ]);

            // Update user stats
            await connection.execute(`
                INSERT INTO user_stats (
                    user_id, total_games_played, total_wagered, total_won,
                    biggest_win, last_active
                ) VALUES (?, 1, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    total_games_played = total_games_played + 1,
                    total_wagered = total_wagered + ?,
                    total_won = total_won + ?,
                    biggest_win = GREATEST(biggest_win, ?),
                    last_active = NOW()
            `, [
                userId, bet.amount, payout.amount, payout.amount,
                bet.amount, payout.amount, payout.amount
            ]);

            // Update game stats
            await connection.execute(`
                INSERT INTO game_stats (
                    game_id, total_rounds, total_wagered, total_payout,
                    average_bet, rtp_percentage, last_updated
                ) VALUES (?, 1, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    total_rounds = total_rounds + 1,
                    total_wagered = total_wagered + ?,
                    total_payout = total_payout + ?,
                    average_bet = (total_wagered + ?) / (total_rounds + 1),
                    rtp_percentage = ((total_payout + ?) / (total_wagered + ?)) * 100,
                    last_updated = NOW()
            `, [
                gameId, bet.amount, payout.amount, bet.amount, 
                (payout.amount / bet.amount) * 100,
                bet.amount, payout.amount, bet.amount, payout.amount, bet.amount
            ]);

            // Update hourly analytics
            await connection.execute(`
                INSERT INTO analytics_hourly (
                    timestamp, currency, games_played, total_wagered,
                    total_payout, profit
                ) VALUES (
                    DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00'),
                    ?, 1, ?, ?, ?
                ) ON DUPLICATE KEY UPDATE
                    games_played = games_played + 1,
                    total_wagered = total_wagered + ?,
                    total_payout = total_payout + ?,
                    profit = total_wagered - total_payout
            `, [
                bet.currency, bet.amount, payout.amount,
                bet.amount - payout.amount, bet.amount, payout.amount
            ]);
        });
    }

    async handleJackpot(data) {
        const { userId, amount, gameRoundId, jackpotType, multiplier } = data;

        await db.transaction(async (connection) => {
            // Record jackpot win
            await connection.execute(`
                INSERT INTO jackpots (
                    user_id, amount, currency, timestamp,
                    game_round_id, jackpot_type, multiplier
                ) VALUES (?, ?, ?, NOW(), ?, ?, ?)
            `, [userId, amount.value, amount.currency, gameRoundId, jackpotType, multiplier]);

            // Update user stats
            await connection.execute(`
                UPDATE user_stats 
                SET jackpots_won = jackpots_won + 1,
                    biggest_win = GREATEST(biggest_win, ?)
                WHERE user_id = ?
            `, [amount.value, userId]);

            // Update game stats
            await connection.execute(`
                UPDATE game_stats 
                SET jackpot_hits = jackpot_hits + 1
                WHERE game_id = (
                    SELECT game_id FROM game_rounds WHERE id = ?
                )
            `, [gameRoundId]);
        });
    }

    async handleUserSession(data) {
        const { userId, deviceInfo, location } = data;

        await db.execute(`
            INSERT INTO user_sessions (
                user_id, start_time, currency, device_info, location
            ) VALUES (?, NOW(), 'BTC', ?, ?)
        `, [userId, JSON.stringify(deviceInfo), JSON.stringify(location)]);
    }

    async endUserSession(data) {
        const { userId } = data;

        await db.transaction(async (connection) => {
            // End the session
            await connection.execute(`
                UPDATE user_sessions 
                SET end_time = NOW()
                WHERE user_id = ? AND end_time IS NULL
            `, [userId]);

            // Calculate session stats
            const [sessionStats] = await connection.execute(`
                SELECT 
                    COUNT(*) as games_played,
                    COALESCE(SUM(bet_amount), 0) as total_wagered,
                    COALESCE(SUM(payout_amount), 0) as total_won
                FROM game_rounds
                WHERE session_id = (
                    SELECT id FROM user_sessions 
                    WHERE user_id = ? 
                    ORDER BY start_time DESC 
                    LIMIT 1
                )
            `, [userId]);

            // Update session with stats
            await connection.execute(`
                UPDATE user_sessions 
                SET games_played = ?,
                    total_wagered = ?,
                    total_won = ?
                WHERE user_id = ? 
                ORDER BY start_time DESC 
                LIMIT 1
            `, [
                sessionStats.games_played,
                sessionStats.total_wagered,
                sessionStats.total_won,
                userId
            ]);
        });
    }

    async handleTransaction(data) {
        const { userId, type, amount, currency } = data;

        await db.transaction(async (connection) => {
            // Update user stats
            await connection.execute(`
                UPDATE user_stats 
                SET total_${type}s = total_${type}s + ?,
                    last_active = NOW()
                WHERE user_id = ?
            `, [amount, userId]);

            // Update hourly analytics
            await connection.execute(`
                INSERT INTO analytics_hourly (
                    timestamp, currency, ${type}_count, ${type}_volume
                ) VALUES (
                    DATE_FORMAT(NOW(), '%Y-%m-%d %H:00:00'),
                    ?, 1, ?
                ) ON DUPLICATE KEY UPDATE
                    ${type}_count = ${type}_count + 1,
                    ${type}_volume = ${type}_volume + ?
            `, [currency, amount, amount]);
        });
    }

    // Analysis Methods

    async getUserAnalytics(userId) {
        const [userStats] = await db.query(`
            SELECT * FROM user_stats WHERE user_id = ?
        `, [userId]);

        const [sessions] = await db.query(`
            SELECT 
                COUNT(*) as total_sessions,
                AVG(TIMESTAMPDIFF(MINUTE, start_time, COALESCE(end_time, NOW()))) as avg_session_time,
                SUM(games_played) as total_games,
                SUM(total_wagered) as total_wagered,
                SUM(total_won) as total_won
            FROM user_sessions
            WHERE user_id = ?
        `, [userId]);

        const [gamePreferences] = await db.query(`
            SELECT 
                game_id,
                COUNT(*) as times_played,
                AVG(bet_amount) as avg_bet,
                SUM(payout_amount) / SUM(bet_amount) * 100 as personal_rtp
            FROM game_rounds
            WHERE user_id = ?
            GROUP BY game_id
            ORDER BY times_played DESC
            LIMIT 5
        `, [userId]);

        const [recentActivity] = await db.query(`
            SELECT 
                'game' as type,
                game_id as id,
                bet_amount as amount,
                timestamp
            FROM game_rounds
            WHERE user_id = ?
            UNION ALL
            SELECT 
                'jackpot' as type,
                id,
                amount,
                timestamp
            FROM jackpots
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT 20
        `, [userId, userId]);

        return {
            stats: userStats,
            sessions,
            gamePreferences,
            recentActivity
        };
    }

    async getGameAnalytics(gameId) {
        const [gameStats] = await db.query(`
            SELECT * FROM game_stats WHERE game_id = ?
        `, [gameId]);

        const [hourlyStats] = await db.query(`
            SELECT 
                DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
                COUNT(*) as rounds_played,
                SUM(bet_amount) as total_wagered,
                SUM(payout_amount) as total_payout,
                COUNT(DISTINCT user_id) as unique_players
            FROM game_rounds
            WHERE game_id = ?
            GROUP BY hour
            ORDER BY hour DESC
            LIMIT 24
        `, [gameId]);

        const [symbolStats] = await db.query(`
            SELECT 
                JSON_EXTRACT(symbols, '$') as symbol_combination,
                COUNT(*) as occurrences,
                AVG(multiplier) as avg_multiplier
            FROM game_rounds
            WHERE game_id = ?
            GROUP BY symbol_combination
            ORDER BY occurrences DESC
            LIMIT 10
        `, [gameId]);

        return {
            stats: gameStats,
            hourlyStats,
            symbolStats
        };
    }

    async getFinancialAnalytics(currency, period = '24h') {
        const timeClause = period === '24h' 
            ? 'timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
            : 'DATE(timestamp) = CURDATE()';

        const [volumeStats] = await db.query(`
            SELECT 
                currency,
                SUM(deposit_volume) as total_deposits,
                SUM(withdrawal_volume) as total_withdrawals,
                COUNT(DISTINCT CASE WHEN deposit_count > 0 THEN id END) as deposit_transactions,
                COUNT(DISTINCT CASE WHEN withdrawal_count > 0 THEN id END) as withdrawal_transactions
            FROM analytics_hourly
            WHERE currency = ? AND ${timeClause}
            GROUP BY currency
        `, [currency]);

        const [hourlyVolume] = await db.query(`
            SELECT 
                DATE_FORMAT(timestamp, '%H:00') as hour,
                SUM(deposit_volume) as deposits,
                SUM(withdrawal_volume) as withdrawals
            FROM analytics_hourly
            WHERE currency = ? AND ${timeClause}
            GROUP BY hour
            ORDER BY hour
        `, [currency]);

        const [profitStats] = await db.query(`
            SELECT 
                currency,
                SUM(total_wagered) as total_wagered,
                SUM(total_payout) as total_payout,
                SUM(profit) as total_profit
            FROM analytics_hourly
            WHERE currency = ? AND ${timeClause}
            GROUP BY currency
        `, [currency]);

        return {
            volume: volumeStats,
            hourlyVolume,
            profit: profitStats
        };
    }
}

module.exports = new AdvancedAnalytics();
