<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Log all requests
error_log("Request Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Request Data: " . file_get_contents('php://input'));
error_log("GET Data: " . print_r($_GET, true));

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
        error_log("Connection failed: " . $conn->connect_error);
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    error_log("Database connected successfully");

    // Handle preflight requests
    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        http_response_code(200);
        exit();
    }

    // Get or create user
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $telegramId = $_GET['telegram_id'] ?? '';
        $username = $_GET['username'] ?? '';

        error_log("Getting user data for telegram_id: $telegramId, username: $username");

        if (empty($telegramId)) {
            throw new Exception('Telegram ID is required');
        }

        // Check if user exists
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->bind_param("s", $telegramId);
        $stmt->execute();
        $result = $stmt->get_result();
        $user = $result->fetch_assoc();

        if ($user) {
            error_log("Found existing user: " . print_r($user, true));
            echo json_encode($user);
            exit();
        }

        error_log("Creating new user with telegram_id: $telegramId");

        // Create new user
        $stmt = $conn->prepare("INSERT INTO users (telegram_id, username, balance) VALUES (?, ?, 10.00)");
        $stmt->bind_param("ss", $telegramId, $username);
        $stmt->execute();

        // Get new user data
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->bind_param("s", $telegramId);
        $stmt->execute();
        $result = $stmt->get_result();
        $newUser = $result->fetch_assoc();

        error_log("Created new user: " . print_r($newUser, true));
        echo json_encode($newUser);
    }

    // Update user data
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $telegramId = $_GET['telegram_id'] ?? '';
        $data = json_decode(file_get_contents('php://input'), true);

        error_log("Updating user data for telegram_id: $telegramId");
        error_log("Update data: " . print_r($data, true));

        if (empty($telegramId)) {
            throw new Exception('Telegram ID is required');
        }

        $balance = $data['balance'] ?? 0;
        $isWin = $data['isWin'] ?? false;
        $winAmount = $data['winAmount'] ?? 0;
        $isJackpot = $data['isJackpot'] ?? false;

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
            $stmt->execute();

            // Get updated user data
            $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
            $stmt->bind_param("s", $telegramId);
            $stmt->execute();
            $result = $stmt->get_result();
            $user = $result->fetch_assoc();

            if (!$user) {
                throw new Exception('User not found');
            }

            $conn->commit();
            error_log("Updated user data: " . print_r($user, true));
            echo json_encode($user);
        } catch (Exception $e) {
            $conn->rollback();
            throw $e;
        }
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
