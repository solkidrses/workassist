import paramiko
import time

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    user_json = '{"id":12345,"first_name":"Test","last_name":"User","username":"testuser"}'

    generate_cmd = f"""cd {PROJECT_DIR} && node -e \"
require('dotenv').config();
const crypto = require('crypto');
const authDate = Math.floor(Date.now() / 1000);
const user = '{user_json}';
const dataCheckString = 'auth_date=' + authDate + '\\nuser=' + user;
const secretKey = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
require('fs').writeFileSync('/tmp/chat_headers.txt', 'x-telegram-init-data: auth_date=' + authDate + '&hash=' + hash + '&user=' + user + '\\nContent-Type: application/json\\n');
console.log('auth_date', authDate);
\" 2>/dev/null"""

    print("Generating initData on server...")
    stdin, stdout, stderr = ssh.exec_command(generate_cmd, timeout=30)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out:
        print(out)
    if err:
        print("GEN ERR:", err)

    cmd = (
        f"cd {PROJECT_DIR} ; curl -i -sS -X POST -o /tmp/chat_body.txt -w '%{{http_code}}' "
        f"-H @/tmp/chat_headers.txt "
        f"-d '{{\"messages\":[{{\"role\":\"user\",\"content\":\"test hello\"}}]}}' "
        f"http://localhost:3000/api/chat ; echo ; echo '---BODY---' ; cat /tmp/chat_body.txt ; rm -f /tmp/chat_body.txt /tmp/chat_headers.txt"
    )

    print("Testing chat API with Telegram initData...")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")

    print("=== Chat API response ===")
    print(out[:3000] if len(out) > 3000 else out)
    if err.strip():
        print("STDERR:", err[:1000])

    ssh.close()

if __name__ == "__main__":
    main()
