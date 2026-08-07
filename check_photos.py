import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

print("=== R2 env vars (masked) ===")
stdin, stdout, stderr = ssh.exec_command(
    f"cd {PROJECT_DIR} && grep -E '^R2_' .env | sed 's/=.*$/=SET/' || echo 'NO R2 VARS'"
)
print(stdout.read().decode().strip())

print("\n=== R2 upload errors in logs ===")
stdin, stdout, stderr = ssh.exec_command(
    "grep -E 'R2 Upload Error' /root/.pm2/logs/next-app-error.log 2>/dev/null | tail -10 || echo 'no R2 errors'"
)
print(stdout.read().decode().strip())

print("\n=== Recent instructions with photoUrl ===")
cmd = f"""cd {PROJECT_DIR} && node -e "
require('dotenv').config();
const {{ PrismaClient }} = require('@prisma/client');
const {{ PrismaPg }} = require('@prisma/adapter-pg');
const adapter = new PrismaPg({{ connectionString: process.env.DATABASE_URL }});
const prisma = new PrismaClient({{ adapter }});
prisma.$queryRawUnsafe('SELECT id, title, \\"sourceType\\", \\"photoUrl\\" FROM instructions ORDER BY \\"createdAt\\" DESC LIMIT 5').then(r => {{
  r.forEach(i => console.log(JSON.stringify({{ title: i.title.slice(0,40), sourceType: i.sourceType, photoUrl: i.photoUrl }})));
  process.exit(0);
}}).catch(e => {{ console.error(e.message); process.exit(1); }});
" 2>&1"""
stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
print(stdout.read().decode().strip())

ssh.close()
