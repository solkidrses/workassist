import paramiko, time

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def run_cmd(ssh, cmd, timeout=300):
    print(f">>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    if out.strip():
        print(out.rstrip())
    print(f"[exit: {exit_code}]")
    print("---")
    return exit_code, out

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)
    print("Connected!")

    run_cmd(ssh, f"cd {PROJECT_DIR} && git pull origin main")
    run_cmd(ssh, f"cd {PROJECT_DIR} && npm run build", timeout=300)
    run_cmd(ssh, "pm2 restart next-app")
    time.sleep(3)
    run_cmd(ssh, "pm2 restart bot")
    time.sleep(2)
    run_cmd(ssh, "pm2 list")
    run_cmd(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ || echo 'curl failed'")

    # Test chat API health
    print("=== Testing chat API with deepseek-v4-flash ===")
    cmd = (
        f"cd {PROJECT_DIR} && source .env 2>/dev/null; "
        f"curl -sS -o /dev/null -w '%{{http_code}}' "
        f"-H 'Content-Type: application/json' "
        f"-d '{{\"messages\":[{{\"role\":\"user\",\"content\":\"test\"}}]}}' "
        f"http://localhost:3000/api/chat"
    )
    run_cmd(ssh, cmd)

    ssh.close()
    print("\n=== Deploy complete ===")

if __name__ == "__main__":
    main()
