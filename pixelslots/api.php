<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Allow all origins
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Log everything
error_log("\n\n=== NEW REQUEST ===");
error_log("Time: " . date('Y-m-d H:i:s'));
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("GET: " . print_r($_GET, true));
error_log("POST: " . print_r($_POST, true));
error_log("Raw Input: " . file_get_contents('php://input'));

// Database configuration
$db_host = 'rdbms.strato.de';
$db_name = 'dbs13505497';
$db_user = 'dbu1342085';
$db_pass = 'KinGKonG1989!';

try {
    // Create connection
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);
    if ($conn->connect_error) {
        throw new Exception("Database connection failed: " . $conn->connect_error);
    }

    // First, make sure the users table exists
    $sql = "CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        telegram_id VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(255),
        balance DECIMAL(10,2) DEFAULT 10.00,
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

    if (!$conn->query($sql)) {
        throw new Exception("Failed to create table: " . $conn->error);
    }

    // Handle preflight requests
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    // Get or create user
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $telegramId = isset($_GET['telegram_id']) ? trim($_GET['telegram_id']) : '';
        $username = isset($_GET['username']) ? trim($_GET['username']) : '';

        error_log("Processing user: telegram_id=$telegramId, username=$username");

        if (empty($telegramId)) {
            throw new Exception("Telegram ID is required");
        }

        // Try to get existing user
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->bind_param("s", $telegramId);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        if ($user) {
            error_log("Found user: " . print_r($user, true));
            echo json_encode($user);
            exit();
        }

        // Create new user
        error_log("Creating new user: telegram_id=$telegramId, username=$username");
        
        $stmt = $conn->prepare("INSERT INTO users (telegram_id, username, balance) VALUES (?, ?, 10.00)");
        $stmt->bind_param("ss", $telegramId, $username);
        
        if (!$stmt->execute()) {
            throw new Exception("Failed to create user: " . $stmt->error);
        }

        // Get the new user
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->bind_param("s", $telegramId);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        error_log("Created user: " . print_r($user, true));
        echo json_encode($user);
    }

    // Update user data
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $telegramId = isset($_GET['telegram_id']) ? trim($_GET['telegram_id']) : '';
        $data = json_decode(file_get_contents('php://input'), true);

        error_log("Updating user: telegram_id=$telegramId");
        error_log("Update data: " . print_r($data, true));

        if (empty($telegramId)) {
            throw new Exception("Telegram ID is required");
        }

        $balance = isset($data['balance']) ? floatval($data['balance']) : 0;
        $isWin = isset($data['isWin']) ? boolval($data['isWin']) : false;
        $winAmount = isset($data['winAmount']) ? floatval($data['winAmount']) : 0;
        $isJackpot = isset($data['isJackpot']) ? boolval($data['isJackpot']) : false;

        // Update user
        $sql = "UPDATE users SET 
                balance = ?,
                total_spins = total_spins + 1,
                " . ($isWin ? "
                    total_wins = total_wins + 1,
                    total_win_amount = total_win_amount + ?,
                    biggest_win = GREATEST(biggest_win, ?),
                    last_win = CURRENT_TIMESTAMP,
                    " . ($isJackpot ? "jackpots_won = jackpots_won + 1," : "") . "
                " : "
                    total_losses = total_losses + 1,
                    total_loss_amount = total_loss_amount + ?,
                ") . "
                last_spin = CURRENT_TIMESTAMP
                WHERE telegram_id = ?";

        $stmt = $conn->prepare($sql);
        if ($isWin) {
            $stmt->bind_param("ddds", $balance, $winAmount, $winAmount, $telegramId);
        } else {
            $stmt->bind_param("dds", $balance, $winAmount, $telegramId);
        }

        if (!$stmt->execute()) {
            throw new Exception("Failed to update user: " . $stmt->error);
        }

        // Get updated user
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->bind_param("s", $telegramId);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        error_log("Updated user: " . print_r($user, true));
        echo json_encode($user);
    }

} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
