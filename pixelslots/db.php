<?php
// Database configuration
$db_host = 'rdbms.strato.de';
$db_name = 'dbs13505497';
$db_user = 'dbu1342085';
$db_pass = 'KinGKonG1989!';

// Create connection
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Create users table if not exists
$sql = "CREATE TABLE IF NOT EXISTS users (
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
)";

if ($conn->query($sql) === FALSE) {
    echo "Error creating table: " . $conn->error;
}
?>
