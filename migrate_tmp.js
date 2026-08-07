require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const sql = fs.readFileSync("add_chat_messages.sql", "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(sql).then(() => {
  console.log("Table chat_messages created OK");
  return pool.end();
}).then(() => process.exit(0)).catch(e => {
  console.error(e.message);
  process.exit(1);
});
