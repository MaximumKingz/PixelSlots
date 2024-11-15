<?php
require_once 'config.php';

class Database {
    private $conn = null;

    public function connect() {
        try {
            if ($this->conn === null) {
                $this->conn = new PDO(
                    "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME,
                    DB_USER,
                    DB_PASS,
                    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
                );
            }
            return $this->conn;
        } catch(PDOException $e) {
            echo json_encode(['error' => 'Connection failed: ' . $e->getMessage()]);
            exit();
        }
    }
}
?>
