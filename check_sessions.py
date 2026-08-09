import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

CHECK_JS = '''require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const s = await pool.query('SELECT id, title, "createdAt" FROM chat_sessions ORDER BY "createdAt" DESC');
  console.log("=== chat_sessions: " + s.rowCount + " ===");
  for (const r of s.rows) console.log(r.createdAt.toISOString(), "|", r.id, "|", r.title);

  const m = await pool.query('SELECT "sessionId", COUNT(*) cnt, MAX("createdAt") last FROM chat_messages GROUP BY "sessionId" ORDER BY last DESC');
  console.log("\\n=== message groups: " + m.rowCount + " ===");
  for (const r of m.rows) console.log(String(r.sessionId), "| cnt:", r.cnt, "| last:", r.last.toISOString());

  const n = await pool.query('SELECT COUNT(*) cnt FROM chat_messages WHERE "sessionId" IS NULL');
  console.log("\\nNULL sessionId msgs:", n.rows[0].cnt);

  const d = await pool.query('SELECT COUNT(*) cnt FROM chat_messages m WHERE m."sessionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = m."sessionId")');
  console.log("dangling msgs (session missing):", d.rows[0].cnt);

  await pool.end();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
'''


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    with open("check_tmp.js", "w", encoding="utf-8") as f:
        f.write(CHECK_JS)

    sftp = ssh.open_sftp()
    sftp.put("check_tmp.js", f"{PROJECT_DIR}/check_tmp.js")
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command(
        f"cd {PROJECT_DIR} && node check_tmp.js 2>&1", timeout=60
    )
    print(stdout.read().decode())
    err = stderr.read().decode().strip()
    if err:
        print("ERR:", err)

    ssh.exec_command(f"rm {PROJECT_DIR}/check_tmp.js")
    ssh.close()


if __name__ == "__main__":
    main()
