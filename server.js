import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Polyhedron Judge API running");
});

app.post("/judge", async (req, res) => {
  try {
    const question = req.body.question;

    if (!question) {
      return res.json({ answer: "No question provided." });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          input: `You are a certified Magic the Gathering judge.

Answer the rules question clearly and correctly using official MTG rules. Be concise but precise.

Question: ${question}`
        })
      }
    );

    const data = await response.json();

    // SAFE DEBUG LINE (does not change behavior)
    console.log(JSON.stringify(data, null, 2));

    let answer = "Judge could not determine the answer.";

    if (data.output_text) {
      answer = data.output_text;
    } else if (data.output && data.output.length > 0) {
      const item = data.output[0];
      if (item.content && item.content.length > 0) {
        answer = item.content[0].text;
      }
    }

    res.json({ answer });

  } catch (error) {
    console.error(error);
    res.json({ answer: "Judge encountered an error." });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Judge server running on port ${PORT}`);
});
