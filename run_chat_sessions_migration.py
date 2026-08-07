import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"


def main():
    sql_file = "migrations/add_chat_sessions.sql"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    sftp = ssh.open_sftp()
    sftp.put(sql_file, f"{PROJECT_DIR}/add_chat_sessions.sql")

    migrate_js = '''require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const sql = fs.readFileSync("add_chat_sessions.sql", "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(sql).then(() => {
  console.log("Migrations applied OK");
  return pool.end();
}).then(() => process.exit(0)).catch(e => {
  console.error(e.message);
  process.exit(1);
});
'''
    with open("migrate_tmp.js", "w", encoding="utf-8") as f:
        f.write(migrate_js)
    sftp.put("migrate_tmp.js", f"{PROJECT_DIR}/migrate_tmp.js")
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command(
        f"cd {PROJECT_DIR} && node migrate_tmp.js 2>&1",
        timeout=60,
    )
    print(stdout.read().decode().strip())
    err = stderr.read().decode().strip()
    if err:
        print("ERR:", err)

    ssh.exec_command(f"rm {PROJECT_DIR}/migrate_tmp.js {PROJECT_DIR}/add_chat_sessions.sql")
    ssh.close()
    print("Done")


if __name__ == "__main__":
    main()
