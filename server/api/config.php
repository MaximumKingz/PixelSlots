<?php
// Database configuration
define('DB_HOST', 'rdbms.strato.de');
define('DB_USER', 'dbu1342085');
define('DB_PASS', 'KinGKonG1989!');
define('DB_NAME', 'dbs13505497');

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Allow CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>
