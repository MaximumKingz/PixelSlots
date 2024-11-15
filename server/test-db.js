require('dotenv').config();
const mysql = require('mysql2');

// Create a connection
const connection = mysql.createConnection({
    host: 'rdbms.strato.de',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
    },
    connectTimeout: 30000 // 30 seconds
});

console.log('Attempting to connect to Strato database...');
console.log('Connection details:', {
    host: 'rdbms.strato.de',
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
    console.log('Successfully connected to database!');

    // Test query
    connection.query('SHOW TABLES', (err, results) => {
        if (err) {
            console.error('Error querying database:', err);
            process.exit(1);
        }
        console.log('Tables in database:', results);

        // Test creating users table
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                telegram_id VARCHAR(255) NOT NULL,
                username VARCHAR(255),
                balance DECIMAL(10,2) DEFAULT 10.00,
                has_received_bonus BOOLEAN DEFAULT TRUE,
                total_spins INT DEFAULT 0,
                total_wins INT DEFAULT 0,
                total_losses INT DEFAULT 0,
                biggest_win DECIMAL(10,2) DEFAULT 0,
                total_win_amount DECIMAL(10,2) DEFAULT 0,
                total_loss_amount DECIMAL(10,2) DEFAULT 0,
                jackpots_won INT DEFAULT 0,
                last_spin TIMESTAMP NULL,
                last_win TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_telegram_id (telegram_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;

        connection.query(createTableQuery, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
                process.exit(1);
            }
            console.log('Users table created/verified successfully');

            // Close connection
            connection.end((err) => {
                if (err) {
                    console.error('Error closing connection:', err);
                    process.exit(1);
                }
                console.log('Connection closed');
                process.exit(0);
            });
        });
    });
});
