require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const r = await pool.query("SELECT id, name, slug, icon, color, \"sortOrder\" FROM categories ORDER BY \"sortOrder\"");
  console.log("Categories in DB:", r.rowCount);
  for (const row of r.rows) console.log(JSON.stringify(row));
  await pool.end();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
