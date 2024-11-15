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

// Data directory
$dataDir = __DIR__ . '/data';
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}

try {
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

        // User data file
        $userFile = $dataDir . '/' . $telegramId . '.json';
        error_log("User file: $userFile");

        // Check if user exists
        if (file_exists($userFile)) {
            $userData = json_decode(file_get_contents($userFile), true);
            error_log("Found user: " . print_r($userData, true));
            echo json_encode($userData);
            exit();
        }

        // Create new user
        error_log("Creating new user: telegram_id=$telegramId, username=$username");
        
        $userData = [
            'telegram_id' => $telegramId,
            'username' => $username,
            'balance' => 10.00,
            'total_spins' => 0,
            'total_wins' => 0,
            'total_losses' => 0,
            'biggest_win' => 0,
            'total_win_amount' => 0,
            'total_loss_amount' => 0,
            'jackpots_won' => 0,
            'last_spin' => null,
            'last_win' => null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];

        // Save user data
        if (!file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT))) {
            throw new Exception("Failed to create user");
        }

        error_log("Created user: " . print_r($userData, true));
        echo json_encode($userData);
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

        // User data file
        $userFile = $dataDir . '/' . $telegramId . '.json';
        if (!file_exists($userFile)) {
            throw new Exception("User not found");
        }

        // Get current user data
        $userData = json_decode(file_get_contents($userFile), true);
        
        // Update user data
        $userData['balance'] = isset($data['balance']) ? floatval($data['balance']) : $userData['balance'];
        $userData['total_spins'] += 1;
        $userData['updated_at'] = date('Y-m-d H:i:s');
        $userData['last_spin'] = date('Y-m-d H:i:s');

        if (isset($data['isWin']) && $data['isWin']) {
            $winAmount = isset($data['winAmount']) ? floatval($data['winAmount']) : 0;
            $userData['total_wins'] += 1;
            $userData['total_win_amount'] += $winAmount;
            $userData['biggest_win'] = max($userData['biggest_win'], $winAmount);
            $userData['last_win'] = date('Y-m-d H:i:s');

            if (isset($data['isJackpot']) && $data['isJackpot']) {
                $userData['jackpots_won'] += 1;
            }
        } else {
            $lossAmount = isset($data['winAmount']) ? floatval($data['winAmount']) : 0;
            $userData['total_losses'] += 1;
            $userData['total_loss_amount'] += $lossAmount;
        }

        // Save user data
        if (!file_put_contents($userFile, json_encode($userData, JSON_PRETTY_PRINT))) {
            throw new Exception("Failed to update user");
        }

        error_log("Updated user: " . print_r($userData, true));
        echo json_encode($userData);
    }

} catch (Exception $e) {
    error_log("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
