<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database configuration
$db_host = 'rdbms.strato.de';
$db_name = 'dbs13505497';
$db_user = 'dbu1342085';
$db_pass = 'KinGKonG1989!';

try {
    // Create connection with PDO
    $conn = new PDO("mysql:host=$db_host;dbname=$db_name", $db_user, $db_pass);
    
    // Set the PDO error mode to exception
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connected successfully to database!<br>";

    // Drop existing users table if it exists
    $conn->exec("DROP TABLE IF EXISTS users");
    echo "Dropped existing users table.<br>";

    // Create users table
    $sql = "CREATE TABLE users (
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_telegram_id (telegram_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $conn->exec($sql);
    echo "Users table created successfully<br>";

    // Create test user
    $sql = "INSERT INTO users (telegram_id, username, balance) VALUES ('test123', 'testuser', 10.00)";
    $conn->exec($sql);
    echo "Test user created successfully<br>";

    // Show table structure
    $sql = "DESCRIBE users";
    $stmt = $conn->query($sql);
    echo "<br>Table structure:<br>";
    echo "<pre>";
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }
    echo "</pre>";

    // Show test user data
    $sql = "SELECT * FROM users";
    $stmt = $conn->query($sql);
    echo "<br>Test user data:<br>";
    echo "<pre>";
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }
    echo "</pre>";

} catch(PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
?>
