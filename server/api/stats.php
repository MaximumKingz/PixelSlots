<?php
require_once 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $telegramId = $_GET['telegram_id'] ?? '';

    if (empty($telegramId)) {
        echo json_encode(['error' => 'Telegram ID is required']);
        exit();
    }

    try {
        $db = new Database();
        $conn = $db->connect();

        $stmt = $conn->prepare("SELECT * FROM users WHERE telegram_id = ?");
        $stmt->execute([$telegramId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            echo json_encode(['error' => 'User not found']);
            exit();
        }

        echo json_encode([
            'telegramId' => $user['telegram_id'],
            'username' => $user['username'],
            'balance' => floatval($user['balance']),
            'stats' => [
                'totalSpins' => intval($user['total_spins']),
                'totalWins' => intval($user['total_wins']),
                'totalLosses' => intval($user['total_losses']),
                'biggestWin' => floatval($user['biggest_win']),
                'totalWinAmount' => floatval($user['total_win_amount']),
                'totalLossAmount' => floatval($user['total_loss_amount']),
                'jackpotsWon' => intval($user['jackpots_won'])
            ],
            'lastSpin' => $user['last_spin'],
            'lastWin' => $user['last_win'],
            'created' => $user['created_at'],
            'hasReceivedBonus' => (bool)$user['has_received_bonus']
        ]);
    } catch(PDOException $e) {
        echo json_encode(['error' => $e->getMessage()]);
    }
}
?>
