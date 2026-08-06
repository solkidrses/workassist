import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    script = """import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
const stream = await client.responses.create({
  model: 'deepseek-v4-flash',
  instructions: 'You are a helpful assistant.',
  input: 'say hi',
  stream: true,
});
for await (const event of stream) {
  if (event.type === 'response.output_text.delta') {
    process.stdout.write(event.delta);
  }
}
"""

    script_path = PROJECT_DIR + "/tmp_test_sdk.mjs"
    stdin, stdout, stderr = ssh.exec_command(f"cat > {script_path} << 'EOF'\n" + script + "\nEOF")
    stdout.read()
    err = stderr.read().decode()
    if err.strip():
        print("Write err:", err)

    print("=== OpenAI SDK streaming test ===")
    stdin, stdout, stderr = ssh.exec_command(f"cd {PROJECT_DIR} && node --env-file=.env tmp_test_sdk.mjs", timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print("OUT:", out[:2000])
    if err.strip():
        print("ERR:", err[:1000])

    ssh.exec_command(f"rm -f {script_path}")
    ssh.close()

if __name__ == "__main__":
    main()
