import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

/* Allow requests from your GitHub Pages site */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

const PORT = process.env.PORT || 3000;

let requests = [];

function rateLimit(req, res, next) {
  const now = Date.now();
  requests = requests.filter(t => now - t < 60000);

  if (requests.length >= 6) {
    return res.json({
      message: "One minute. Judge currently answering other calls."
    });
  }

  requests.push(now);
  next();
}

app.post("/judge", rateLimit, async (req, res) => {
  const question = req.body.question;

  if (!question) {
    return res.status(400).json({ error: "No question provided" });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `
You are an official Magic: The Gathering rules judge.

Provide answers in the following format:

Ruling:
Explanation:
Rule Reference (CR numbers):
Suggested Fix:

Question: ${question}
`
      })
    });

    const data = await response.json();

    res.json({
      answer: data.output[0].content[0].text
    });

  } catch (error) {
    res.status(500).json({
      message: "judge offline"
    });
  }
});

app.get("/", (req, res) => {
  res.send("Polyhedron Judge Online");
});

app.listen(PORT, () => {
  console.log("Judge server running on port", PORT);
});
