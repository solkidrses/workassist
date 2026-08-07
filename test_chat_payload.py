import paramiko

HOST = "72.56.52.159"
USER = "root"
PASSWORD = "jevz2vpTdbPsMuV"
PROJECT_DIR = "/app/workassist"

def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=15)

    instructions = (
        "You are an AI assistant helping a user with their personal work instructions database.\n"
        "Your purpose is to answer the user's questions based ONLY on the Context instructions provided in the user message.\n\n"
        "Guidelines:\n"
        "1. Always maintain a professional, technical, yet friendly tone.\n"
        "2. Use the provided Context instructions to construct your answers.\n"
        "3. If the retrieved context instructions contradict each other, call attention to this conflict immediately and detail both versions.\n"
        "4. Reference the instructions you used by their exact Titles.\n"
        '5. If no relevant instructions are found, explicitly state: "В вашей базе инструкций нет информации по этому вопросу." Do not make up answers.\n'
        "6. Support formatting using Markdown."
    )
    input_text = "User question: test hello"

    script = f"""const key = process.env.DEEPSEEK_API_KEY;
const res = await fetch('https://api.deepseek.com/responses', {{
  method: 'POST',
  headers: {{
    'Authorization': `Bearer ${{key}}`,
    'Content-Type': 'application/json'
  }},
  body: JSON.stringify({{
    model: 'deepseek-v4-flash',
    instructions: {repr(instructions)},
    input: {repr(input_text)},
    stream: true
  }})
}});
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = '';
for (let i = 0; i < 40; i++) {{
  const {{ done, value }} = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, {{ stream: true }});
}}
reader.cancel();
console.log(buffer.slice(0, 3000));
"""

    stdin, stdout, stderr = ssh.exec_command("cat > /tmp/test_chat_payload.mjs << 'EOF'\n" + script + "\nEOF")
    out = stdout.read().decode()
    err = stderr.read().decode()
    if err.strip():
        print("Write err:", err)

    print("=== Raw DeepSeek v4 with chat payload ===")
    stdin, stdout, stderr = ssh.exec_command("node --env-file=" + PROJECT_DIR + "/.env /tmp/test_chat_payload.mjs", timeout=30)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    print(out[:3000])
    if err.strip():
        print("STDERR:", err)

    ssh.exec_command("rm -f /tmp/test_chat_payload.mjs")
    ssh.close()

if __name__ == "__main__":
    main()
