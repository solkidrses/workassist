import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

# Create chat_messages table on the server
cmd = f"""cd {PROJECT_DIR} && node -e "
require('dotenv').config();
const {{ Pool }} = require('pg');
const pool = new Pool({{ connectionString: process.env.DATABASE_URL }});
const sql = `CREATE TABLE IF NOT EXISTS chat_messages (id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, \\"createdAt\\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT chat_messages_pkey PRIMARY KEY (id))`;
pool.query(sql).then(() => {{ console.log('Table chat_messages created OK'); pool.end(); process.exit(0); }}).catch(e => {{ console.error(e.message); pool.end(); process.exit(1); }});
" 2>&1"""

stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print(stdout.read().decode().strip())

ssh.close()
