import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

CHECK_JS = '''require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const r = await pool.query("SELECT id, name, slug, icon, color, \\"sortOrder\\" FROM categories ORDER BY \\"sortOrder\\"");
  console.log("Categories in DB:", r.rowCount);
  for (const row of r.rows) console.log(JSON.stringify(row));
  await pool.end();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
'''


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    with open("check_cat_tmp.js", "w", encoding="utf-8") as f:
        f.write(CHECK_JS)

    sftp = ssh.open_sftp()
    sftp.put("check_cat_tmp.js", f"{PROJECT_DIR}/check_cat_tmp.js")
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command(
        f"cd {PROJECT_DIR} && node check_cat_tmp.js 2>&1", timeout=60
    )
    print(stdout.read().decode())
    err = stderr.read().decode().strip()
    if err:
        print("ERR:", err)

    ssh.exec_command(f"rm {PROJECT_DIR}/check_cat_tmp.js")
    ssh.close()


if __name__ == "__main__":
    main()
