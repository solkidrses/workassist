import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    # Get BOT_TOKEN exactly as dotenv/Node sees it
    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_DIR} && node -e \"require('dotenv').config(); console.log(process.env.BOT_TOKEN)\" 2>/dev/null")
    bot_token = stdout.read().decode().strip()
    
    print(f"Token length: {len(bot_token)}")
    print(f"Testing chat API with bot token...")
    cmd = (
        f"cd {PROJECT_DIR} ; TOKEN='{bot_token}' ; curl -i -sS -X POST -o /tmp/chat_body.txt -w '%{{http_code}}' "
        f"-H 'Content-Type: application/json' "
        f"-H \"x-bot-token: $TOKEN\" "
        f"-d '{{\"messages\":[{{\"role\":\"user\",\"content\":\"test hello\"}}]}}' "
        f"http://localhost:3000/api/chat ; echo ; echo '---BODY---' ; cat /tmp/chat_body.txt ; rm -f /tmp/chat_body.txt"
    )
    
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    
    print("=== Chat API response ===")
    print(out[:2000] if len(out) > 2000 else out)
    if err.strip():
        print("STDERR:", err)
    
    ssh.close()

if __name__ == "__main__":
    main()
