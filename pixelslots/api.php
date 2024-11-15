<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

require __DIR__ . '/vendor/autoload.php';

// Initialize Supabase
$supabase = new CreateClient(
    'https://vcspybmymfmxhvqeehkp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjc3B5Ym15bWZteGh2cWVlaGtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE2OTU3NzEsImV4cCI6MjA0NzI3MTc3MX0.wyzWwNd5F0HDjKCRPnSZ7vXajh6XVa9t0TjU5PG6P7I'
);

// Get the request data
$data = json_decode(file_get_contents('php://input'), true);

// Handle bot commands
if (isset($data['message'])) {
    $chat_id = $data['message']['chat']['id'];
    $user = $data['message']['from'];
    $text = $data['message']['text'] ?? '';

    // Handle /start command
    if ($text === '/start') {
        try {
            // Check if user exists
            $result = $supabase
                ->from('users')
                ->select('*')
                ->eq('telegram_id', $user['id'])
                ->execute();

            if (!$result->count) {
                // Create new user
                $newUser = [
                    'telegram_id' => $user['id'],
                    'username' => $user['username'] ?? '',
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

                $supabase
                    ->from('users')
                    ->insert($newUser)
                    ->execute();

                // Send welcome message with $10 bonus
                $message = "🎰 Welcome to Pixel Slots! 🎰\n\n";
                $message .= "You've received \$10.00 FREE to start playing!\n\n";
                $message .= "Click the button below to start playing:";

                // Create inline keyboard with game link
                $keyboard = [
                    'inline_keyboard' => [
                        [
                            [
                                'text' => '🎮 PLAY NOW!',
                                'web_app' => [
                                    'url' => 'https://maximumkingz.github.io/PixelSlots/pixelslots/'
                                ]
                            ]
                        ]
                    ]
                ];
            } else {
                // User already exists
                $message = "Welcome back to Pixel Slots! 🎰\n\n";
                $message .= "Click the button below to continue playing:";

                // Create inline keyboard with game link
                $keyboard = [
                    'inline_keyboard' => [
                        [
                            [
                                'text' => '🎮 PLAY NOW!',
                                'web_app' => [
                                    'url' => 'https://maximumkingz.github.io/PixelSlots/pixelslots/'
                                ]
                            ]
                        ]
                    ]
                ];
            }

            // Send message with keyboard
            $response = [
                'method' => 'sendMessage',
                'chat_id' => $chat_id,
                'text' => $message,
                'reply_markup' => json_encode($keyboard),
                'parse_mode' => 'HTML'
            ];

            echo json_encode($response);
            exit;
        } catch (Exception $e) {
            // Log error and send generic error message
            error_log($e->getMessage());
            $response = [
                'method' => 'sendMessage',
                'chat_id' => $chat_id,
                'text' => "Sorry, something went wrong. Please try again later."
            ];
            echo json_encode($response);
            exit;
        }
    }
}

// Default response
$response = [
    'method' => 'sendMessage',
    'chat_id' => $chat_id ?? null,
    'text' => "Sorry, I don't understand that command."
];

echo json_encode($response);
