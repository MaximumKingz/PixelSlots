const advancedAnalytics = require('../services/advancedAnalytics');
const db = require('../services/dbService');

class AnalyticsController {
    // User Analytics
    async getUserAnalytics(req, res) {
        try {
            const { userId } = req.params;
            const analytics = await advancedAnalytics.getUserAnalytics(userId);
            res.json(analytics);
        } catch (error) {
            console.error('User analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user analytics'
            });
        }
    }

    // Game Analytics
    async getGameAnalytics(req, res) {
        try {
            const { gameId } = req.params;
            const analytics = await advancedAnalytics.getGameAnalytics(gameId);
            res.json(analytics);
        } catch (error) {
            console.error('Game analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch game analytics'
            });
        }
    }

    // Financial Analytics
    async getFinancialAnalytics(req, res) {
        try {
            const { currency, period } = req.query;
            const analytics = await advancedAnalytics.getFinancialAnalytics(currency, period);
            res.json(analytics);
        } catch (error) {
            console.error('Financial analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch financial analytics'
            });
        }
    }

    // Performance Analytics
    async getPerformanceMetrics(req, res) {
        try {
            const { startDate, endDate } = req.query;

            const [metrics] = await db.query(`
                SELECT 
                    DATE(timestamp) as date,
                    COUNT(DISTINCT user_id) as daily_active_users,
                    SUM(games_played) as total_games,
                    SUM(total_wagered) as total_wagered,
                    SUM(total_won) as total_won,
                    AVG(TIMESTAMPDIFF(MINUTE, start_time, end_time)) as avg_session_time
                FROM user_sessions
                WHERE timestamp BETWEEN ? AND ?
                GROUP BY date
                ORDER BY date DESC
            `, [startDate, endDate]);

            const [retentionData] = await db.query(`
                WITH UserDates AS (
                    SELECT 
                        user_id,
                        DATE(MIN(start_time)) as first_day,
                        DATE(MAX(start_time)) as last_day
                    FROM user_sessions
                    GROUP BY user_id
                )
                SELECT 
                    first_day,
                    COUNT(*) as new_users,
                    SUM(CASE WHEN DATEDIFF(last_day, first_day) >= 1 THEN 1 ELSE 0 END) as day_1,
                    SUM(CASE WHEN DATEDIFF(last_day, first_day) >= 7 THEN 1 ELSE 0 END) as day_7,
                    SUM(CASE WHEN DATEDIFF(last_day, first_day) >= 30 THEN 1 ELSE 0 END) as day_30
                FROM UserDates
                WHERE first_day BETWEEN ? AND ?
                GROUP BY first_day
                ORDER BY first_day DESC
            `, [startDate, endDate]);

            res.json({
                metrics,
                retention: retentionData
            });
        } catch (error) {
            console.error('Performance metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch performance metrics'
            });
        }
    }

    // Feature Analytics
    async getFeatureAnalytics(req, res) {
        try {
            const { startDate, endDate } = req.query;

            const [featureStats] = await db.query(`
                SELECT 
                    JSON_EXTRACT(features, '$.name') as feature_name,
                    COUNT(*) as trigger_count,
                    AVG(payout_amount / bet_amount) as avg_multiplier,
                    SUM(payout_amount) as total_payout
                FROM game_rounds
                WHERE 
                    timestamp BETWEEN ? AND ?
                    AND features IS NOT NULL
                GROUP BY feature_name
                ORDER BY trigger_count DESC
            `, [startDate, endDate]);

            const [symbolCombos] = await db.query(`
                SELECT 
                    JSON_EXTRACT(symbols, '$') as symbol_combination,
                    COUNT(*) as occurrences,
                    AVG(multiplier) as avg_multiplier,
                    SUM(payout_amount) as total_payout
                FROM game_rounds
                WHERE timestamp BETWEEN ? AND ?
                GROUP BY symbol_combination
                ORDER BY occurrences DESC
                LIMIT 20
            `, [startDate, endDate]);

            res.json({
                features: featureStats,
                symbols: symbolCombos
            });
        } catch (error) {
            console.error('Feature analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch feature analytics'
            });
        }
    }

    // Jackpot Analytics
    async getJackpotAnalytics(req, res) {
        try {
            const { startDate, endDate } = req.query;

            const [jackpotStats] = await db.query(`
                SELECT 
                    DATE(timestamp) as date,
                    jackpot_type,
                    COUNT(*) as hits,
                    SUM(amount) as total_amount,
                    AVG(amount) as avg_amount,
                    MAX(amount) as max_amount
                FROM jackpots
                WHERE timestamp BETWEEN ? AND ?
                GROUP BY date, jackpot_type
                ORDER BY date DESC, hits DESC
            `, [startDate, endDate]);

            const [topWinners] = await db.query(`
                SELECT 
                    j.user_id,
                    COUNT(*) as jackpot_wins,
                    SUM(j.amount) as total_won,
                    MAX(j.amount) as biggest_win,
                    us.total_games_played,
                    us.total_wagered
                FROM jackpots j
                JOIN user_stats us ON j.user_id = us.user_id
                WHERE j.timestamp BETWEEN ? AND ?
                GROUP BY j.user_id
                ORDER BY total_won DESC
                LIMIT 10
            `, [startDate, endDate]);

            res.json({
                stats: jackpotStats,
                topWinners
            });
        } catch (error) {
            console.error('Jackpot analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch jackpot analytics'
            });
        }
    }

    // User Behavior Analytics
    async getUserBehaviorAnalytics(req, res) {
        try {
            const { startDate, endDate } = req.query;

            const [betPatterns] = await db.query(`
                SELECT 
                    user_id,
                    COUNT(*) as total_bets,
                    AVG(bet_amount) as avg_bet,
                    MIN(bet_amount) as min_bet,
                    MAX(bet_amount) as max_bet,
                    STDDEV(bet_amount) as bet_variance
                FROM game_rounds
                WHERE timestamp BETWEEN ? AND ?
                GROUP BY user_id
                HAVING total_bets > 100
                ORDER BY total_bets DESC
                LIMIT 100
            `, [startDate, endDate]);

            const [timePatterns] = await db.query(`
                SELECT 
                    HOUR(timestamp) as hour,
                    COUNT(*) as game_count,
                    COUNT(DISTINCT user_id) as unique_users,
                    AVG(bet_amount) as avg_bet
                FROM game_rounds
                WHERE timestamp BETWEEN ? AND ?
                GROUP BY hour
                ORDER BY hour
            `, [startDate, endDate]);

            const [sessionPatterns] = await db.query(`
                SELECT 
                    CASE 
                        WHEN games_played < 10 THEN 'short'
                        WHEN games_played < 50 THEN 'medium'
                        ELSE 'long'
                    END as session_type,
                    COUNT(*) as session_count,
                    AVG(TIMESTAMPDIFF(MINUTE, start_time, end_time)) as avg_duration,
                    AVG(total_wagered) as avg_wagered,
                    AVG(total_won) as avg_won
                FROM user_sessions
                WHERE 
                    start_time BETWEEN ? AND ?
                    AND end_time IS NOT NULL
                GROUP BY session_type
            `, [startDate, endDate]);

            res.json({
                betPatterns,
                timePatterns,
                sessionPatterns
            });
        } catch (error) {
            console.error('User behavior analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch user behavior analytics'
            });
        }
    }

    // Risk Analytics
    async getRiskAnalytics(req, res) {
        try {
            const { startDate, endDate } = req.query;

            const [highRiskUsers] = await db.query(`
                WITH UserMetrics AS (
                    SELECT 
                        user_id,
                        COUNT(*) as total_games,
                        SUM(bet_amount) as total_wagered,
                        SUM(payout_amount) as total_won,
                        MAX(bet_amount) as max_bet,
                        AVG(bet_amount) as avg_bet,
                        STDDEV(bet_amount) as bet_stddev
                    FROM game_rounds
                    WHERE timestamp BETWEEN ? AND ?
                    GROUP BY user_id
                    HAVING total_games > 50
                )
                SELECT 
                    um.*,
                    (total_won / total_wagered * 100) as win_rate,
                    (bet_stddev / avg_bet) as bet_volatility
                FROM UserMetrics um
                WHERE 
                    total_won > total_wagered * 2
                    OR max_bet > avg_bet * 10
                ORDER BY total_wagered DESC
                LIMIT 100
            `, [startDate, endDate]);

            const [unusualPatterns] = await db.query(`
                WITH GamePatterns AS (
                    SELECT 
                        user_id,
                        game_id,
                        timestamp,
                        bet_amount,
                        payout_amount,
                        LAG(timestamp) OVER (PARTITION BY user_id ORDER BY timestamp) as prev_timestamp,
                        LAG(bet_amount) OVER (PARTITION BY user_id ORDER BY timestamp) as prev_bet
                    FROM game_rounds
                    WHERE timestamp BETWEEN ? AND ?
                )
                SELECT 
                    user_id,
                    COUNT(*) as pattern_count,
                    MIN(timestamp) as first_occurrence,
                    MAX(timestamp) as last_occurrence
                FROM GamePatterns
                WHERE 
                    TIMESTAMPDIFF(SECOND, prev_timestamp, timestamp) < 2
                    OR bet_amount = prev_bet
                GROUP BY user_id
                HAVING pattern_count > 100
                ORDER BY pattern_count DESC
            `, [startDate, endDate]);

            res.json({
                highRiskUsers,
                unusualPatterns
            });
        } catch (error) {
            console.error('Risk analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch risk analytics'
            });
        }
    }
}

module.exports = new AnalyticsController();
