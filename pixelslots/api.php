<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Database configuration
$db_host = 'rdbms.strato.de';
$db_name = 'dbs13505497';
$db_user = 'dbu1342085';
$db_pass = 'KinGKonG1989!';

// Create connection
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// Check connection
if ($conn->connect_error) {
    die(json_encode(['error' => 'Connection failed: ' . $conn->connect_error]));
}

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Get user data
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $telegramId = $_GET['telegram_id'] ?? '';
    $username = $_GET['username'] ?? '';

    if (empty($telegramId)) {
        echo json_encode(['error' => 'Telegram ID is required']);
        exit();
    }

    // Check if user exists
    $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
    $stmt->bind_param("s", $telegramId);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    if ($user) {
        echo json_encode($user);
        exit();
    }

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

    echo json_encode($newUser);
}

// Update user data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $telegramId = $_GET['telegram_id'] ?? '';
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($telegramId)) {
        echo json_encode(['error' => 'Telegram ID is required']);
        exit();
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
        echo json_encode($user);
    } catch (Exception $e) {
        $conn->rollback();
        echo json_encode(['error' => $e->getMessage()]);
    }
}

$conn->close();
?>
