<?php
header('Content-Type: application/json');

// Bot token
$botToken = '6919885330:AAGPNFvHAiPHwPGBNZJVVPSvALkNRnzPfNs';

// Supabase credentials
$supabaseUrl = 'https://vcspybmymfmxhvqeehkp.supabase.co';
$supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjc3B5Ym15bWZteGh2cWVlaGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2OTU3NzEsImV4cCI6MjA0NzI3MTc3MX0.wyzWwNd5F0HDjKCRPnSZ7vXajh6XVa9t0TjU5PG6P7I';

// Game URL
$gameUrl = 'https://maximumkingz.github.io/PixelSlots/pixelslots/';

// Get update from Telegram
$update = json_decode(file_get_contents('php://input'), true);

// Log update for debugging
error_log('Telegram Update: ' . print_r($update, true));

// Function to send message
function sendMessage($chatId, $text, $keyboard = null) {
    global $botToken;
    
    $data = [
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => 'HTML'
    ];
    
    if ($keyboard) {
        $data['reply_markup'] = json_encode($keyboard);
    }
    
    $ch = curl_init("https://api.telegram.org/bot$botToken/sendMessage");
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return $response;
}

// Function to create user in Supabase
function createUser($userId, $username) {
    global $supabaseUrl, $supabaseKey;
    
    $data = [
        'telegram_id' => (string)$userId,
        'username' => $username,
        'balance' => 10.00,
        'total_spins' => 0,
        'total_wins' => 0,
        'total_losses' => 0,
        'biggest_win' => 0,
        'total_win_amount' => 0,
        'total_loss_amount' => 0,
        'jackpots_won' => 0,
        'last_spin' => date('c'),
        'last_win' => date('c'),
        'created_at' => date('c'),
        'updated_at' => date('c')
    ];
    
    $ch = curl_init("$supabaseUrl/rest/v1/users");
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . $supabaseKey,
        'Authorization: Bearer ' . $supabaseKey,
        'Content-Type: application/json',
        'Prefer: return=minimal'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    return $httpCode === 201;
}

// Function to check if user exists in Supabase
function userExists($userId) {
    global $supabaseUrl, $supabaseKey;
    
    $ch = curl_init("$supabaseUrl/rest/v1/users?telegram_id=eq.$userId");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . $supabaseKey,
        'Authorization: Bearer ' . $supabaseKey
    ]);
    
    $response = json_decode(curl_exec($ch), true);
    curl_close($ch);
    
    return !empty($response);
}

// Handle /start command
if (isset($update['message']) && isset($update['message']['text']) && $update['message']['text'] === '/start') {
    $chatId = $update['message']['chat']['id'];
    $user = $update['message']['from'];
    $userId = $user['id'];
    $username = $user['username'] ?? $user['first_name'] ?? '';
    
    try {
        // Check if user exists
        if (!userExists($userId)) {
            // Create new user
            if (!createUser($userId, $username)) {
                throw new Exception('Failed to create user');
            }
            
            // Welcome message for new users
            $message = "🎰 Welcome to Pixel Slots! 🎰\n\n";
            $message .= "You've received \$10.00 FREE to start playing!\n\n";
            $message .= "Click the button below to start playing:";
        } else {
            // Welcome back message
            $message = "Welcome back to Pixel Slots! 🎰\n\n";
            $message .= "Click the button below to continue playing:";
        }
        
        // Create inline keyboard with game button
        $keyboard = [
            'inline_keyboard' => [
                [
                    [
                        'text' => '🎮 PLAY NOW!',
                        'web_app' => [
                            'url' => $gameUrl
                        ]
                    ]
                ]
            ]
        ];
        
        // Send message with keyboard
        sendMessage($chatId, $message, $keyboard);
    } catch (Exception $e) {
        error_log('Error: ' . $e->getMessage());
        sendMessage($chatId, "Sorry, something went wrong. Please try again later.");
    }
}

// Default response
http_response_code(200);
