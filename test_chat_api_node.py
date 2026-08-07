import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    # Get BOT_TOKEN
    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_DIR} && node -e \"require('dotenv').config(); console.log(process.env.BOT_TOKEN)\" 2>/dev/null")
    bot_token = stdout.read().decode().strip()
    print(f"Token length: {len(bot_token)}")

    script = f"""const res = await fetch('http://localhost:3000/api/chat', {{
  method: 'POST',
  headers: {{
    'Content-Type': 'application/json',
    'x-bot-token': {repr(bot_token)}
  }},
  body: JSON.stringify({{ messages: [{{ role: 'user', content: 'test hello' }}] }})
}});
console.log('status:', res.status);
const reader = res.body.getReader();
const decoder = new TextDecoder();
let done = false;
let buffer = '';
let count = 0;
while (!done && count < 40) {{
  const {{ value, done: d }} = await reader.read();
  done = d;
  if (value) {{
    buffer += decoder.decode(value, {{ stream: true }});
    count++;
  }}
}}
reader.cancel();
console.log('body:', buffer.slice(0, 500));
"""

    script_path = PROJECT_DIR + "/tmp_chat_test.mjs"
    stdin, stdout, stderr = ssh.exec_command(f"cat > {script_path} << 'EOF'\n" + script + "\nEOF")
    stdout.read()
    err = stderr.read().decode()
    if err.strip():
        print("Write err:", err)

    print("=== Chat API via node fetch ===")
    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_DIR} && node {script_path}", timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out[:2000])
    if err.strip():
        print("STDERR:", err[:1000])

    ssh.exec_command(f"rm -f {script_path}")
    ssh.close()

if __name__ == "__main__":
    main()
