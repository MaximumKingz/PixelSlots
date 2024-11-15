require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();

// Allow requests from GitHub Pages and local development
app.use(cors({
    origin: ['https://maximumkingz.github.io', 'http://localhost:3000', 'http://localhost:8080'],
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

// Create MySQL connection pool
const pool = mysql.createPool({
    host: 'rdbms.strato.de',
    user: 'dbu1342085',
    password: 'KinGKonG1989!',
    database: 'dbs13505497',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to MySQL database');
        connection.release();
        return true;
    } catch (error) {
        console.error('Error connecting to database:', error);
        return false;
    }
}

// Initialize database on startup
testConnection().catch(console.error);

// Basic health check
app.get('/', async (req, res) => {
    try {
        await testConnection();
        res.json({ status: 'Server is running', database: 'Connected' });
    } catch (error) {
        res.status(500).json({ status: 'Server is running', database: 'Disconnected', error: error.message });
    }
});

// Get or create user data
app.get('/api/user/:telegramId', async (req, res) => {
    let connection;
    try {
        const { telegramId } = req.params;
        const username = req.query.username || '';

        console.log('Looking for user:', { telegramId, username });

        connection = await pool.getConnection();

        // Try to find existing user
        const [users] = await connection.query(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId]
        );

        if (users.length > 0) {
            console.log('Found existing user:', users[0]);
            connection.release();
            return res.json(users[0]);
        }

        // Create new user if not exists
        console.log('Creating new user with $10 bonus');
        await connection.beginTransaction();

        await connection.query(
            'INSERT INTO users (telegram_id, username, balance, has_received_bonus) VALUES (?, ?, 10.00, TRUE)',
            [telegramId, username]
        );

        const [newUser] = await connection.query(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId]
        );

        await connection.commit();
        console.log('New user created:', newUser[0]);
        res.json(newUser[0]);
    } catch (error) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        console.error('Error in user creation/retrieval:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Update user balance and stats
app.post('/api/user/:telegramId/update', async (req, res) => {
    let connection;
    try {
        const { telegramId } = req.params;
        const { balance, isWin, winAmount, isJackpot } = req.body;

        console.log('Updating user:', { telegramId, balance, isWin, winAmount, isJackpot });

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Update user data
        const updateQuery = `
            UPDATE users 
            SET 
                balance = ?,
                total_spins = total_spins + 1,
                ${isWin ? `
                    total_wins = total_wins + 1,
                    total_win_amount = total_win_amount + ?,
                    biggest_win = GREATEST(biggest_win, ?),
                    last_win = CURRENT_TIMESTAMP,
                    ${isJackpot ? 'jackpots_won = jackpots_won + 1,' : ''}
                ` : `
                    total_losses = total_losses + 1,
                    total_loss_amount = total_loss_amount + ?,
                `}
                last_spin = CURRENT_TIMESTAMP
            WHERE telegram_id = ?
        `;

        await connection.query(
            updateQuery,
            isWin ? [balance, winAmount, winAmount, telegramId] : [balance, winAmount, telegramId]
        );

        // Get updated user data
        const [users] = await connection.query(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId]
        );

        if (users.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'User not found' });
        }

        await connection.commit();
        console.log('User updated successfully:', users[0]);
        res.json(users[0]);
    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error updating user:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

// Get user statistics
app.get('/api/user/:telegramId/stats', async (req, res) => {
    let connection;
    try {
        const { telegramId } = req.params;
        
        connection = await pool.getConnection();
        const [users] = await connection.query(
            'SELECT * FROM users WHERE telegram_id = ?',
            [telegramId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        res.json({
            telegramId: user.telegram_id,
            username: user.username,
            balance: parseFloat(user.balance),
            stats: {
                totalSpins: user.total_spins,
                totalWins: user.total_wins,
                totalLosses: user.total_losses,
                biggestWin: parseFloat(user.biggest_win),
                totalWinAmount: parseFloat(user.total_win_amount),
                totalLossAmount: parseFloat(user.total_loss_amount),
                jackpotsWon: user.jackpots_won
            },
            lastSpin: user.last_spin,
            lastWin: user.last_win,
            created: user.created_at,
            hasReceivedBonus: Boolean(user.has_received_bonus)
        });
    } catch (error) {
        console.error('Error getting user stats:', error);
        res.status(500).json({
            error: 'Server error',
            details: error.message
        });
    } finally {
        if (connection) connection.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
