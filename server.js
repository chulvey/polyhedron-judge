import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID;

app.get("/", (req, res) => {
  res.send("Polyhedron Judge API running");
});

function buildRulesPrompt(question, assumesCompetitive) {
  const relLine = assumesCompetitive
    ? "Assume Competitive REL for the primary analysis because the question references cEDH or a competitive Commander context."
    : "Default to Regular REL unless the facts clearly establish a competitive event context.";

  return `You are Polyhedron Judge, a Magic: The Gathering judge assistant.

Answer the user's question using clean MTG judging structure.

Requirements:
- Use this format:

Ruling:
[short direct ruling]

Fix:
[what happens in the game]

[Include Remedy section ONLY if an infraction or penalty could apply at ANY REL]

- If Remedy is included, use:
Remedy:
1. [Regular REL result] @ REL: Regular
2. [Competitive REL result] @ REL: Competitive

- If no penalty applies at any REL, OMIT the Remedy section entirely.
- Include Comprehensive Rules numbers where applicable.
- Include infraction names/codes where applicable (GRV, Missed Trigger, USC-Minor, FtMGS), but do not force an infraction.
- Do not provide strategy or coaching.
- Keep the answer concise and technically precise.
- ${relLine}

Question: ${question}`;
}

function buildLivePrompt(question, assumesCompetitive) {
  const relLine = assumesCompetitive
    ? "Because the question references cEDH or competitive Commander, treat Competitive REL as the primary enforcement assumption."
    : "If not specified, default to Regular REL while still evaluating both REL outcomes.";

  return `You are Polyhedron Judge handling a Live Judge Call for Commander/cEDH.

Before answering, classify the issue:
(A) Game mechanics
(B) Tournament policy / infraction / remedy
(C) Multiplayer Rule 0 modification

Decision rules:
- If (B): Determine fix and remedy using IPG/JAR FIRST. Do NOT let CR override policy remedy.
- If (A): Use CR for mechanics, then check if policy changes fix/remedy.
- If Rule 0 modifies the result, explicitly state: "Polyhedron Rule 0 Modification Applied".

Missed Trigger policy:
- If the trigger was missed and is not too old, an opponent chooses whether to add it to the stack.
- If generally detrimental: Competitive REL → Missed Trigger (Warning).

Output requirements:

Ruling:
[short direct ruling]

Fix:
[what happens in the game]

[Include Remedy section ONLY if any REL could assign an infraction]

- If Remedy is included, use:
Remedy:
1. [Regular REL result] @ REL: Regular
2. [Competitive REL result] @ REL: Competitive

- If no infraction applies at any REL, OMIT Remedy entirely.
- Include Comprehensive Rules numbers where applicable.
- Include IPG/JAR references when used.
- Only display "Polyhedron Rule 0 Modification Applied" if actually used.
- Do NOT provide strategy or coaching.
- Keep ruling concise and authoritative.
- ${relLine}

Question: ${question}`;
}

function extractAnswer(data) {
  if (data.output_text && typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data.output)) {
    const texts = [];
    for (const item of data.output) {
      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (typeof part.text === "string") {
            texts.push(part.text);
          } else if (part.text && typeof part.text.value === "string") {
            texts.push(part.text.value);
          }
        }
      }
    }
    const joined = texts.join("\n").trim();
    if (joined) return joined;
  }

  return "Judge could not determine the answer.";
}

app.post("/judge", async (req, res) => {
  try {
    const question = req.body.question;
    const mode = req.body.mode === "live" ? "live" : "rules";

    if (!question || !String(question).trim()) {
      return res.json({ answer: "No question provided." });
    }

    const assumesCompetitive = /\bcedh\b|competitive commander|competitive rel|tournament/i.test(question);

    if (mode === "live" && !VECTOR_STORE_ID) {
      return res.json({
        answer: "Ruling:\nLive Judge Call is not configured.\n\nFix:\nAdd the configured authority vector store to the service."
      });
    }

    const payload = {
      model: MODEL,
      input: mode === "live"
        ? buildLivePrompt(question, assumesCompetitive)
        : buildRulesPrompt(question, assumesCompetitive)
    };

    if (mode === "live") {
      payload.tools = [
        {
          type: "file_search",
          vector_store_ids: [VECTOR_STORE_ID]
        }
      ];
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI error:", JSON.stringify(data, null, 2));
      const message = data?.error?.message || "Judge encountered an error.";
      return res.json({ answer: message });
    }

    const answer = extractAnswer(data);
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
