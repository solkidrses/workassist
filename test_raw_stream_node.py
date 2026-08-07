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

    script = f"""const key = process.env.DEEPSEEK_API_KEY;
const res = await fetch('https://api.deepseek.com/responses', {{
  method: 'POST',
  headers: {{
    'Authorization': `Bearer ${{key}}`,
    'Content-Type': 'application/json'
  }},
  body: JSON.stringify({{
    model: 'deepseek-v4-flash',
    instructions: 'You are a helpful assistant.',
    input: 'say hi',
    stream: true
  }})
}});
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
for (let i = 0; i < 30; i++) {{
  const {{ done, value }} = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, {{ stream: true }});
}}
reader.cancel();
console.log(buffer.slice(0, 3000));
"""
    # Write script to server
    stdin, stdout, stderr = ssh.exec_command("cat > /tmp/test_stream.mjs << 'EOF'\n" + script + "\nEOF")
    out = stdout.read().decode()
    err = stderr.read().decode()
    if err.strip():
        print("Write err:", err)

    # Run it
    print("=== Raw SSE from DeepSeek v4 ===")
    stdin, stdout, stderr = ssh.exec_command("node --env-file=" + PROJECT_DIR + "/.env /tmp/test_stream.mjs", timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out[:3000])
    if err.strip():
        print("STDERR:", err)

    ssh.exec_command("rm -f /tmp/test_stream.mjs")
    ssh.close()

if __name__ == "__main__":
    main()
