import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    sftp = ssh.open_sftp()
    sftp.put("migrations/add_categories.sql", f"{PROJECT_DIR}/add_categories.sql")

    migrate_js = '''require("dotenv").config();
const { Pool } = require("pg");
const fs = require("fs");
const sql = fs.readFileSync("add_categories.sql", "utf8");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(sql).then(() => {
  console.log("Categories migration applied OK");
  return pool.query("SELECT id, name, slug, \\"sortOrder\\" FROM categories ORDER BY \\"sortOrder\\"");
}).then(r => {
  console.log("Categories:", JSON.stringify(r.rows));
  return pool.end();
}).then(() => process.exit(0)).catch(e => {
  console.error(e.message);
  process.exit(1);
});
'''
    with open("migrate_cat_tmp.js", "w", encoding="utf-8") as f:
        f.write(migrate_js)
    sftp.put("migrate_cat_tmp.js", f"{PROJECT_DIR}/migrate_cat_tmp.js")
    sftp.close()

    stdin, stdout, stderr = ssh.exec_command(
        f"cd {PROJECT_DIR} && node migrate_cat_tmp.js 2>&1",
        timeout=60,
    )
    print(stdout.read().decode().strip())
    err = stderr.read().decode().strip()
    if err:
        print("ERR:", err)

    ssh.exec_command(f"rm {PROJECT_DIR}/migrate_cat_tmp.js {PROJECT_DIR}/add_categories.sql")
    ssh.close()
    print("Done")


if __name__ == "__main__":
    main()
