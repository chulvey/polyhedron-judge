import express from "express"
import cors from "cors"
import fetch from "node-fetch"

const app = express()

app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 10000

app.get("/", (req,res)=>{
res.send("Polyhedron Judge Online")
})

app.post("/ask", async (req,res)=>{

try{

const question = req.body.question

const response = await fetch(
"https://api.openai.com/v1/chat/completions",
{
method:"POST",
headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`
},
body:JSON.stringify({
model:"gpt-4o-mini",
messages:[
{
role:"system",
content:"You are a Magic the Gathering rules judge. Give short accurate rulings and reference rules when possible."
},
{
role:"user",
content:question
}
]
})
}
)

const data = await response.json()

const answer =
data?.choices?.[0]?.message?.content ||
"Judge could not determine the answer."

res.json({answer})

}catch(err){

console.log(err)

res.json({
answer:"Judge server error"
})

}

})

app.listen(PORT,()=>{
console.log("Judge server running on port",PORT)
})
