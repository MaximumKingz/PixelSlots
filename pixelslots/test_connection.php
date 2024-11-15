<?php
// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Database configuration
$db_host = 'rdbms.strato.de';
$db_name = 'dbs13505497';
$db_user = 'dbu1342085';
$db_pass = 'KinGKonG1989!';

try {
    // Create connection with PDO
    $conn = new PDO("mysql:host=$db_host;dbname=$db_name", $db_user, $db_pass);
    
    // Set the PDO error mode to exception
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connected successfully to database!<br>";

    // Show all tables
    $sql = "SHOW TABLES";
    $stmt = $conn->query($sql);
    echo "<br>Tables in database:<br>";
    echo "<pre>";
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }
    echo "</pre>";

    // Show users table structure if it exists
    $sql = "DESCRIBE users";
    $stmt = $conn->query($sql);
    echo "<br>Users table structure:<br>";
    echo "<pre>";
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }
    echo "</pre>";

    // Show users data if any exists
    $sql = "SELECT * FROM users";
    $stmt = $conn->query($sql);
    echo "<br>Users data:<br>";
    echo "<pre>";
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }
    echo "</pre>";

} catch(PDOException $e) {
    echo "Connection failed: " . $e->getMessage();
}
?>
