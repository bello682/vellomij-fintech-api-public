require("dotenv/config");

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function testDatabase() {
  try {
    console.log("Testing PostgreSQL connection...");

    const result = await pool.query("SELECT NOW()");

    console.log("✅ DATABASE CONNECTION SUCCESSFUL");
    console.log("Database time:", result.rows[0].now);
  } catch (error) {
    console.error("❌ DATABASE CONNECTION FAILED");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Address:", error.address);
    console.error("Port:", error.port);
  } finally {
    await pool.end();
  }
}

testDatabase();
