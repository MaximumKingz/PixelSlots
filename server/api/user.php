<?php
require_once 'db.php';

// Get or create user
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $telegramId = $_GET['telegram_id'] ?? '';
    $username = $_GET['username'] ?? '';

    if (empty($telegramId)) {
        echo json_encode(['error' => 'Telegram ID is required']);
        exit();
    }

    try {
        $db = new Database();
        $conn = $db->connect();

        // Check if user exists
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->execute([$telegramId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            echo json_encode($user);
            exit();
        }

        // Create new user
        $stmt = $conn->prepare("
            INSERT INTO users (telegram_id, username, balance, has_received_bonus)
            VALUES (?, ?, 10.00, TRUE)
        ");
        $stmt->execute([$telegramId, $username]);

        // Get new user data
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->execute([$telegramId]);
        $newUser = $stmt->fetch(PDO::FETCH_ASSOC);

        echo json_encode($newUser);
    } catch(PDOException $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
}

// Update user
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $telegramId = $_GET['telegram_id'] ?? '';
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($telegramId)) {
        echo json_encode(['error' => 'Telegram ID is required']);
        exit();
    }

    try {
        $db = new Database();
        $conn = $db->connect();
        $conn->beginTransaction();

        $balance = $data['balance'] ?? 0;
        $isWin = $data['isWin'] ?? false;
        $winAmount = $data['winAmount'] ?? 0;
        $isJackpot = $data['isJackpot'] ?? false;

        // Update user data
        $updateQuery = "
            UPDATE users 
            SET 
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
            WHERE telegram_id = ?
        ";

        $stmt = $conn->prepare($updateQuery);
        if ($isWin) {
            $stmt->execute([$balance, $winAmount, $winAmount, $telegramId]);
        } else {
            $stmt->execute([$balance, $winAmount, $telegramId]);
        }

        // Get updated user data
        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->execute([$telegramId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $conn->rollBack();
            echo json_encode(['error' => 'User not found']);
            exit();
        }

        $conn->commit();
        echo json_encode($user);
    } catch(PDOException $e) {
        if ($conn) {
            $conn->rollBack();
        }
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>
