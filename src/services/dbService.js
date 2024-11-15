const mysql = require('mysql2/promise');

class DatabaseService {
    constructor() {
        this.pool = mysql.createPool({
            host: 'database-5016671608.webspace-host.com',
            user: 'dbu1342085',
            password: 'KinGKOnG1989!',
            database: 'dbs13505497',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });

        this.setupTables();
    }

    async setupTables() {
        try {
            const connection = await this.pool.getConnection();

            // Analytics Tables
            await connection.query(`
                CREATE TABLE IF NOT EXISTS analytics_hourly (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    timestamp DATETIME NOT NULL,
                    currency VARCHAR(10) NOT NULL,
                    deposit_count INT DEFAULT 0,
                    deposit_volume DECIMAL(20, 8) DEFAULT 0,
                    withdrawal_count INT DEFAULT 0,
                    withdrawal_volume DECIMAL(20, 8) DEFAULT 0,
                    games_played INT DEFAULT 0,
                    total_wagered DECIMAL(20, 8) DEFAULT 0,
                    total_payout DECIMAL(20, 8) DEFAULT 0,
                    profit DECIMAL(20, 8) DEFAULT 0,
                    active_users INT DEFAULT 0,
                    new_users INT DEFAULT 0,
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_currency (currency)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS analytics_daily (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    date DATE NOT NULL,
                    currency VARCHAR(10) NOT NULL,
                    deposit_count INT DEFAULT 0,
                    deposit_volume DECIMAL(20, 8) DEFAULT 0,
                    withdrawal_count INT DEFAULT 0,
                    withdrawal_volume DECIMAL(20, 8) DEFAULT 0,
                    games_played INT DEFAULT 0,
                    total_wagered DECIMAL(20, 8) DEFAULT 0,
                    total_payout DECIMAL(20, 8) DEFAULT 0,
                    profit DECIMAL(20, 8) DEFAULT 0,
                    unique_users INT DEFAULT 0,
                    new_users INT DEFAULT 0,
                    retention_rate DECIMAL(5, 2) DEFAULT 0,
                    average_session_time INT DEFAULT 0,
                    INDEX idx_date (date),
                    INDEX idx_currency (currency)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    start_time DATETIME NOT NULL,
                    end_time DATETIME,
                    games_played INT DEFAULT 0,
                    total_wagered DECIMAL(20, 8) DEFAULT 0,
                    total_won DECIMAL(20, 8) DEFAULT 0,
                    currency VARCHAR(10) NOT NULL,
                    device_info JSON,
                    location JSON,
                    INDEX idx_user_id (user_id),
                    INDEX idx_start_time (start_time)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS game_rounds (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    game_id VARCHAR(255) NOT NULL,
                    timestamp DATETIME NOT NULL,
                    bet_amount DECIMAL(20, 8) NOT NULL,
                    payout_amount DECIMAL(20, 8) NOT NULL,
                    currency VARCHAR(10) NOT NULL,
                    multiplier DECIMAL(10, 2) NOT NULL,
                    symbols JSON NOT NULL,
                    paylines JSON,
                    features JSON,
                    session_id BIGINT,
                    INDEX idx_user_id (user_id),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_session_id (session_id),
                    FOREIGN KEY (session_id) REFERENCES user_sessions(id)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS jackpots (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    amount DECIMAL(20, 8) NOT NULL,
                    currency VARCHAR(10) NOT NULL,
                    timestamp DATETIME NOT NULL,
                    game_round_id BIGINT,
                    jackpot_type VARCHAR(50) NOT NULL,
                    multiplier DECIMAL(10, 2) NOT NULL,
                    INDEX idx_user_id (user_id),
                    INDEX idx_timestamp (timestamp),
                    FOREIGN KEY (game_round_id) REFERENCES game_rounds(id)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS user_achievements (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    achievement_id VARCHAR(255) NOT NULL,
                    timestamp DATETIME NOT NULL,
                    data JSON,
                    INDEX idx_user_id (user_id),
                    INDEX idx_achievement (achievement_id)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS user_stats (
                    user_id VARCHAR(255) PRIMARY KEY,
                    total_games_played INT DEFAULT 0,
                    total_wagered DECIMAL(20, 8) DEFAULT 0,
                    total_won DECIMAL(20, 8) DEFAULT 0,
                    biggest_win DECIMAL(20, 8) DEFAULT 0,
                    jackpots_won INT DEFAULT 0,
                    total_deposits DECIMAL(20, 8) DEFAULT 0,
                    total_withdrawals DECIMAL(20, 8) DEFAULT 0,
                    last_active DATETIME,
                    favorite_games JSON,
                    achievements_count INT DEFAULT 0,
                    level INT DEFAULT 1,
                    experience_points BIGINT DEFAULT 0,
                    INDEX idx_last_active (last_active)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS game_stats (
                    game_id VARCHAR(255) PRIMARY KEY,
                    total_rounds INT DEFAULT 0,
                    total_wagered DECIMAL(20, 8) DEFAULT 0,
                    total_payout DECIMAL(20, 8) DEFAULT 0,
                    jackpot_hits INT DEFAULT 0,
                    unique_players INT DEFAULT 0,
                    average_bet DECIMAL(20, 8) DEFAULT 0,
                    rtp_percentage DECIMAL(5, 2) DEFAULT 0,
                    hit_frequency DECIMAL(5, 2) DEFAULT 0,
                    feature_triggers JSON,
                    last_updated DATETIME,
                    INDEX idx_total_rounds (total_rounds)
                ) ENGINE=InnoDB;
            `);

            await connection.query(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    type ENUM('transaction', 'user', 'admin', 'security', 'system', 'game') NOT NULL,
                    action VARCHAR(255) NOT NULL,
                    user_id VARCHAR(255),
                    admin_id VARCHAR(255),
                    data JSON NOT NULL,
                    metadata JSON,
                    severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
                    timestamp DATETIME NOT NULL,
                    INDEX idx_type_action (type, action),
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_user_id (user_id),
                    INDEX idx_severity (severity)
                ) ENGINE=InnoDB;
            `);

            connection.release();
            console.log('Database tables created successfully');
        } catch (error) {
            console.error('Error setting up database tables:', error);
            throw error;
        }
    }

    async query(sql, params = []) {
        try {
            const [results] = await this.pool.execute(sql, params);
            return results;
        } catch (error) {
            console.error('Database query error:', error);
            throw error;
        }
    }

    async transaction(callback) {
        const connection = await this.pool.getConnection();
        await connection.beginTransaction();

        try {
            const result = await callback(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async end() {
        await this.pool.end();
    }
}

module.exports = new DatabaseService();
