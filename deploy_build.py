import paramiko
import os
import subprocess
import tarfile

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

def main():
    os.chdir(LOCAL_DIR)

    # Build locally if not already built
    if not os.path.isdir(".next"):
        print("Building locally...")
        result = subprocess.run(["npm", "run", "build"], shell=True, capture_output=True, text=True)
        print(result.stdout)
        if result.returncode != 0:
            print("Build failed:", result.stderr)
            return

    # Tar the .next and public directories
    print("Packing .next and public...")
    tar_path = os.path.join(LOCAL_DIR, "next-build.tar.gz")
    with tarfile.open(tar_path, "w:gz") as tar:
        tar.add(".next", arcname=".next")
        if os.path.isdir("public"):
            tar.add("public", arcname="public")

    print(f"Archive size: {os.path.getsize(tar_path) / 1024 / 1024:.2f} MB")

    # Upload and extract
    print("Connecting to server...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    sftp = ssh.open_sftp()
    remote_tar = f"{PROJECT_DIR}/next-build.tar.gz"
    print("Uploading archive...")
    sftp.put(tar_path, remote_tar)
    sftp.close()

    print("Extracting and restarting...")
    stdin, stdout, stderr = ssh.exec_command(
        f"cd {PROJECT_DIR} && "
        f"if [ -d public/uploads ]; then cp -r public/uploads /tmp/uploads_backup; fi && "
        f"rm -rf .next && tar -xzf next-build.tar.gz && rm next-build.tar.gz && "
        f"if [ -d /tmp/uploads_backup ]; then cp -r /tmp/uploads_backup/* public/uploads/ 2>/dev/null; rm -rf /tmp/uploads_backup; fi && "
        f"pm2 restart next-app",
        timeout=120,
    )
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out)
    if err.strip():
        print("ERR:", err)

    # Clean up local tar
    os.remove(tar_path)

    ssh.close()
    print("Done")

if __name__ == "__main__":
    main()
