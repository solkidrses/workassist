import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    for cmd in [
        "pm2 logs next-app --lines 200 --nostream 2>/dev/null | tail -120",
        "grep -E 'DEBUG|Chat Error' /root/.pm2/logs/next-app-error.log 2>/dev/null | tail -40",
        "tail -n 80 /root/.pm2/logs/next-app-error.log 2>/dev/null | tail -80",
        "journalctl -u pm2-root -n 80 --no-pager 2>/dev/null | tail -80",
    ]:
        print(f"=== {cmd} ===")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", errors="replace")
        if out.strip():
            print(out.rstrip())
        else:
            print("(no output)")
        print()

    ssh.close()

if __name__ == "__main__":
    main()
