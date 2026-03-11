import express from "express"
import cors from "cors"

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 10000

app.post("/ask", async (req, res) => {

  try {

    const question = req.body.question

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`
        },
        body:JSON.stringify({
          model:"gpt-4o-mini",
          input:`You are a Magic the Gathering rules judge. Answer clearly and briefly.

Question: ${question}`
        })
      }
    )

    const data = await response.json()

    const answer =
      data?.output?.[0]?.content?.[0]?.text ||
      "Judge could not determine the answer."

    res.json({ answer })

  } catch (err) {

    console.log(err)

    res.json({ answer: "Judge server error" })

  }

})

app.listen(PORT, () => {
  console.log("Judge server running on port", PORT)
})
