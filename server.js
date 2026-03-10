import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

const recentRequests = [];
function rateLimit(req, res, next) {
  const now = Date.now();
  while (recentRequests.length && now - recentRequests[0] > 60000) recentRequests.shift();
  if (recentRequests.length >= 6) {
    return res.status(429).json({
      message: "One minute. Judge currently answering other calls.",
      answer: ""
    });
  }
  recentRequests.push(now);
  next();
}

app.get("/", (req, res) => {
  res.send("Polyhedron Judge Online");
});

app.post("/ask", rateLimit, async (req, res) => {
  const question = (req.body?.question || "").trim();
  if (!question) {
    return res.status(400).json({ message: "judge offline", answer: "No question provided." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ message: "judge offline", answer: "Missing OPENAI_API_KEY." });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
`You are a Magic: The Gathering judge focused on Commander/EDH.
Return exactly these sections in white-visible text order:
RULING
EXPLANATION
RULE REFERENCE
SUGGESTED FIXES
Then append one final line:
CONFIDENCE: High or Medium or Low
Use official Comprehensive Rules logic. Cite CR numbers whenever possible. Keep rulings concise and decisive.`
          },
          { role: "user", content: question }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("OpenAI error", data);
      return res.status(500).json({ message: "judge offline", answer: "Judge server error." });
    }

    const answer = data.choices?.[0]?.message?.content?.trim() || "Judge could not determine the answer.";
    return res.json({ message: "judge online", answer });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "judge offline", answer: "Judge server error." });
  }
});

app.listen(PORT, () => {
  console.log(`Judge server running on port ${PORT}`);
});
