require("dotenv").config();
const OpenAI = require("openai").default;

(async () => {
  const key = process.env.EMBEDDINGS_API_KEY;
  console.log("EMBEDDINGS_API_KEY present:", !!key);
  console.log("EMBEDDINGS_API_KEY is dummy:", key === "dummy_key" || !key);

  if (key && key !== "dummy_key") {
    try {
      const openai = new OpenAI({ apiKey: key });
      const res = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: "test",
      });
      console.log("API key works! Vector size:", res.data[0].embedding.length);
    } catch (e) {
      console.log("API key ERROR:", e.message);
    }
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
