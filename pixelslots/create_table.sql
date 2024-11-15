DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_id VARCHAR(255) NOT NULL UNIQUE,
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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
