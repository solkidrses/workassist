import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    # Get DEEPSEEK_API_KEY
    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_DIR} && node -e \"require('dotenv').config(); console.log(process.env.DEEPSEEK_API_KEY)\" 2>/dev/null")
    key = stdout.read().decode().strip()

    print(f"Key length: {len(key)}")
    print("=== Raw DeepSeek v4-flash streaming response ===")
    cmd = (
        f"curl -sS -X POST https://api.deepseek.com/responses "
        f"-H 'Authorization: Bearer {key}' "
        f"-H 'Content-Type: application/json' "
        f"-d '{{\"model\":\"deepseek-v4-flash\",\"instructions\":\"You are a helpful assistant.\",\"input\":\"say hi\",\"stream\":true}}' "
        f"--max-time 20 | head -c 4000"
    )
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=25)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")

    print(out)
    if err.strip():
        print("STDERR:", err)

    ssh.close()

if __name__ == "__main__":
    main()
