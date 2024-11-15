<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Log everything
error_log("=== NEW REQUEST ===");
error_log("Request Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Raw POST Data: " . file_get_contents('php://input'));
error_log("GET Data: " . print_r($_GET, true));
error_log("POST Data: " . print_r($_POST, true));

// Database configuration
$db_host = 'rdbms.strato.de';
$db_name = 'dbs13505497';
$db_user = 'dbu1342085';
$db_pass = 'KinGKonG1989!';

try {
    // Create connection
    $conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

    // Check connection
    if ($conn->connect_error) {
        error_log("Database connection failed: " . $conn->connect_error);
        throw new Exception("Connection failed");
    }

    error_log("Database connected successfully");

    // Handle preflight requests
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    // Get or create user
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $telegramId = isset($_GET['telegram_id']) ? trim($_GET['telegram_id']) : '';
        $username = isset($_GET['username']) ? trim($_GET['username']) : '';

        error_log("Processing user: telegram_id=$telegramId, username=$username");

        if (empty($telegramId)) {
            error_log("Error: No telegram_id provided");
            throw new Exception('Telegram ID is required');
        }

        // First try to get existing user
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ? LIMIT 1");
        $stmt->bind_param("s", $telegramId);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        if ($user) {
            error_log("Found existing user: " . print_r($user, true));
            echo json_encode($user);
            exit();
        }

        error_log("No existing user found, creating new user");

        // Create new user with transaction
        $conn->begin_transaction();

        try {
            // Insert new user
            $stmt = $conn->prepare("INSERT INTO users (telegram_id, username, balance) VALUES (?, ?, 10.00)");
            $stmt->bind_param("ss", $telegramId, $username);
            
            if (!$stmt->execute()) {
                error_log("Error creating user: " . $stmt->error);
                throw new Exception("Failed to create user");
            }

            // Get the new user data
            $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ? LIMIT 1");
            $stmt->bind_param("s", $telegramId);
            $stmt->execute();
            $result = $stmt->get_result();
            $newUser = $result->fetch_assoc();

            if (!$newUser) {
                error_log("Error: User not found after creation");
                throw new Exception("User creation failed");
            }

            $conn->commit();
            error_log("Successfully created new user: " . print_r($newUser, true));
            echo json_encode($newUser);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error in user creation transaction: " . $e->getMessage());
            throw $e;
        }
    }

    // Update user data
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $telegramId = isset($_GET['telegram_id']) ? trim($_GET['telegram_id']) : '';
        $data = json_decode(file_get_contents('php://input'), true);

        error_log("Updating user: telegram_id=$telegramId");
        error_log("Update data: " . print_r($data, true));

        if (empty($telegramId)) {
            error_log("Error: No telegram_id provided for update");
            throw new Exception('Telegram ID is required');
        }

        $balance = isset($data['balance']) ? floatval($data['balance']) : 0;
        $isWin = isset($data['isWin']) ? boolval($data['isWin']) : false;
        $winAmount = isset($data['winAmount']) ? floatval($data['winAmount']) : 0;
        $isJackpot = isset($data['isJackpot']) ? boolval($data['isJackpot']) : false;

        // Start transaction
        $conn->begin_transaction();

        try {
            // Update user data
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
                error_log("Error updating user: " . $stmt->error);
                throw new Exception("Failed to update user");
            }

            // Get updated user data
            $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ? LIMIT 1");
            $stmt->bind_param("s", $telegramId);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();

            if (!$user) {
                error_log("Error: User not found after update");
                throw new Exception('User not found');
            }

            $conn->commit();
            error_log("Successfully updated user: " . print_r($user, true));
            echo json_encode($user);
        } catch (Exception $e) {
            $conn->rollback();
            error_log("Error in update transaction: " . $e->getMessage());
            throw $e;
        }
    }
} catch (Exception $e) {
    error_log("Fatal error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?>
