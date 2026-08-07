import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    for cmd in [
        f"cd {PROJECT_DIR} && ls -la .next",
        f"cd {PROJECT_DIR} && find .next -maxdepth 2 -type d | head -30",
        f"cd {PROJECT_DIR} && cat .next/BUILD_ID",
    ]:
        print(f"=== {cmd} ===")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print("ERR:", err.rstrip())

    ssh.close()

if __name__ == "__main__":
    main()
