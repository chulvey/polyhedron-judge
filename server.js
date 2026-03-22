import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_VECTOR_STORE_ID = process.env.OPENAI_VECTOR_STORE_ID || "";


app.get("/", (req, res) => {
  res.send("Polyhedron Judge API running");
});

app.post("/judge", async (req, res) => {
  try {
    const question = req.body.question;
    const mode = req.body.mode === "live" ? "live" : "rules";
    if (!question) {
      return res.json({ answer: "No question provided." });
    }

    if (!OPENAI_API_KEY) {
      return res.json({ answer: "Judge is not configured with an OpenAI API key." });
    }

    if (mode === "live" && !OPENAI_VECTOR_STORE_ID) {
      return res.json({
        answer: "Live Judge Call is not configured yet. Add OPENAI_VECTOR_STORE_ID to the judge server environment after your authority documents are uploaded to an OpenAI vector store."
      });
    }

    const sharedOutputRules = `
Return your answer using exactly this structure and labels:

Ruling:
[direct ruling only]

Fix:
[what happens in the game right now]

Only include the following section if any REL could assess an infraction or penalty. If included, list both Regular and Competitive outcomes:

Remedy:
1. [Regular REL outcome] @ REL: Regular
2. [Competitive REL outcome] @ REL: Competitive

Only include the following line if you actually relied on the Polyhedron Rule 0 document to change or clarify the result:
Polyhedron Rule 0 Modification Applied

Authority:
[list the controlling documents and section identifiers you relied on. Include CR rule numbers where applicable. Include IPG/JAR/MTR sections when applicable.]

Formatting rules:
- Do not include sections other than the ones above.
- If no REL would assess any infraction or penalty, omit the Remedy section entirely.
- If a Remedy section is included and one REL has no infraction, explicitly say "No infraction" for that REL.
- Include CR numbers whenever applicable to the ruling.
- Keep the answer concise and judge-like.
`;

    const rulesInput = `You are Polyhedron Judge, a certified Magic: The Gathering rules assistant.

Mode: Rules Question

This is not a live judge call. Do not use retrieval tools or outside documents. Answer from model knowledge, but still structure the answer like a judge ruling.

Assume Regular REL by default. If the question explicitly mentions cEDH, competitive EDH, or competitive Commander, assume Competitive REL for interpretation and mention that in the Remedy section if a remedy is applicable.

${sharedOutputRules}

Question: ${question}`;

    const liveInput = `You are Polyhedron Judge, a certified Magic: The Gathering judge handling a live judge call.

Mode: Live Judge Call

You must consult the provided authority documents before answering.

Decision procedure you must follow:
1. First classify the issue: mechanics, policy/infraction/remedy, tournament procedure, or Polyhedron Rule 0 multiplayer modification.
2. If the issue involves a missed trigger, GRV, HCE, FMGS, slow play, communication policy, or any remedy/penalty question, determine the fix and remedy from IPG or JAR first. Do not let Comprehensive Rules override IPG or JAR remedy.
3. Use MTR for tournament procedure and communication structure.
4. Use CR for the underlying game mechanics and include CR rule numbers where applicable.
5. Use Polyhedron Rule 0 and CAF only when they actually change or clarify multiplayer Commander handling inside this system.
6. Do not coach lines of play or provide strategy.

Specific missed trigger instruction:
- Apply the missed trigger remedy from JAR/IPG before concluding.
- In Competitive REL missed trigger situations, if the trigger is generally detrimental for its controller, the Competitive REL remedy is Missed Trigger — Warning when applicable.
- For missed triggers not excluded by timing, an opponent may choose whether the trigger is added to the stack. In multiplayer, any one opponent may make that election.

Context assumption:
- If the question mentions cEDH, competitive EDH, or competitive Commander, assume Competitive REL.
- Otherwise assume Regular REL unless the facts clearly describe a Competitive REL event.

${sharedOutputRules}

Question: ${question}`;

    const payload = {
      model: OPENAI_MODEL,
      input: mode === "live" ? liveInput : rulesInput
    };

    if (mode === "live") {
      payload.tools = [
        {
          type: "file_search",
          vector_store_ids: [OPENAI_VECTOR_STORE_ID],
          max_num_results: 8
        }
      ];
      payload.tool_choice = { type: "file_search" };
      payload.include = ["file_search_call.results"];
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));

    let answer = "Judge could not determine the answer.";

    if (data.output_text) {
      answer = data.output_text;
    } else if (data.output && data.output.length > 0) {
      const messageItem = data.output.find((item) => item.type === "message");
      if (messageItem && messageItem.content && messageItem.content.length > 0) {
        const textItem = messageItem.content.find((item) => item.type === "output_text");
        if (textItem && textItem.text) {
          answer = textItem.text;
        }
      }
    }

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.json({ answer: answer || "Judge encountered an error." });
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
