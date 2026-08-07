import paramiko
import time

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

time.sleep(3)
stdin, stdout, stderr = ssh.exec_command("curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/")
code = stdout.read().decode().strip()
print(f"HTTP {code}")

stdin, stdout, stderr = ssh.exec_command("pm2 list 2>/dev/null | grep -E 'next-app|bot'")
print(stdout.read().decode().strip())

ssh.close()
