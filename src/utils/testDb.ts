import pool from "./db";

async function testConnection() {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log("Успешное подключение к базе данных:", res.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error("Ошибка подключения к базе данных:", err);
    process.exit(1);
  }
}

testConnection();
