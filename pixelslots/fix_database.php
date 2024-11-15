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
    // Create connection with mysqli
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    
    // Check connection
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }
    
    // Start transaction
    $conn->autocommit(FALSE);

    // Check if users table exists
    $result = $conn->query("SHOW TABLES LIKE 'users'");
    if ($result->num_rows == 0) {
        // Create users table if it doesn't exist
        $createTable = "CREATE TABLE users (
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
        
        $conn->query($createTable);
        echo "Created users table\n";
    }

    // Add missing columns
    $columns = [
        "balance" => "DECIMAL(10,2) DEFAULT 10.00",
        "has_received_bonus" => "BOOLEAN DEFAULT TRUE",
        "total_spins" => "INT DEFAULT 0",
        "total_wins" => "INT DEFAULT 0",
        "total_losses" => "INT DEFAULT 0",
        "biggest_win" => "DECIMAL(10,2) DEFAULT 0",
        "total_win_amount" => "DECIMAL(10,2) DEFAULT 0",
        "total_loss_amount" => "DECIMAL(10,2) DEFAULT 0",
        "jackpots_won" => "INT DEFAULT 0",
        "last_spin" => "TIMESTAMP NULL",
        "last_win" => "TIMESTAMP NULL",
        "created_at" => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "updated_at" => "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    ];

    $result = $conn->query("DESCRIBE users");
    $existing_columns = [];
    while ($row = $result->fetch_assoc()) {
        $existing_columns[] = $row['Field'];
    }

    foreach ($columns as $column => $definition) {
        if (!in_array($column, $existing_columns)) {
            $sql = "ALTER TABLE users ADD COLUMN $column $definition";
            $conn->query($sql);
            echo "Added column: $column\n";
        }
    }

    // Add unique index if it doesn't exist
    $result = $conn->query("SHOW INDEX FROM users WHERE Key_name = 'unique_telegram_id'");
    if ($result->num_rows == 0) {
        $conn->query("ALTER TABLE users ADD UNIQUE KEY unique_telegram_id (telegram_id)");
        echo "Added unique index on telegram_id\n";
    }

    // Update NULL values
    $conn->query("UPDATE users SET balance = 10.00 WHERE balance IS NULL");
    $conn->query("UPDATE users SET has_received_bonus = TRUE WHERE has_received_bonus IS NULL");
    echo "Updated NULL values\n";

    // Commit changes
    $conn->commit();
    echo "All changes committed successfully!\n";

    // Show current structure
    $result = $conn->query("DESCRIBE users");
    echo "\nCurrent table structure:\n";
    while ($row = $result->fetch_assoc()) {
        print_r($row);
        echo "\n";
    }

    // Show current data
    $result = $conn->query("SELECT * FROM users");
    echo "\nCurrent users:\n";
    while ($row = $result->fetch_assoc()) {
        print_r($row);
        echo "\n";
    }

} catch (Exception $e) {
    if (isset($conn)) {
        $conn->rollback();
    }
    echo "Error: " . $e->getMessage() . "\n";
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
