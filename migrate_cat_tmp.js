require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const sql = fs.readFileSync("add_categories.sql", "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(sql).then(() => {
  console.log("Categories migration applied OK");
  return pool.query("SELECT id, name, slug, \"sortOrder\" FROM categories ORDER BY \"sortOrder\"");
}).then(r => {
  console.log("Categories:", JSON.stringify(r.rows));
  return pool.end();
}).then(() => process.exit(0)).catch(e => {
  console.error(e.message);
  process.exit(1);
});
