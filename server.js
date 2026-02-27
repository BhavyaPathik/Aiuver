const multer = require("multer")
const pdfParse = require("pdf-parse")
const express = require("express")
const cors = require("cors")
require("dotenv").config()

let resumeText = ""
const upload = multer({ storage: multer.memoryStorage() })

const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args))

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static("public"))

async function callGemini(prompt) {
    const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": process.env.GEMINI_API_KEY
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            })
        }
    )

    const data = await response.json()
    console.log("RAW:", JSON.stringify(data, null, 2))

    return data.candidates?.[0]?.content?.parts?.[0]?.text
}

app.post("/question", async (req, res) => {
  const { role, level, questionNumber } = req.body

  const difficultyMap = {
    1: {
      label: "Beginner",
      style: "basic conceptual and foundational questions",
      tone: "friendly but structured"
    },
    2: {
      label: "Intermediate",
      style: "applied practical questions requiring explanation and examples",
      tone: "professional and moderately challenging"
    },
    3: {
      label: "Advanced",
      style: "deep technical problem-solving questions with real-world context",
      tone: "serious and analytical"
    },
    4: {
      label: "Expert",
      style: "edge cases, system design thinking, optimization and trade-offs",
      tone: "strict and highly analytical"
    }
  }

  const selected = difficultyMap[level] || difficultyMap[3]

  const prompt = `
You are a strict technical interviewer.

Role: ${role}
Level: ${selected.label}
Question Number: ${questionNumber}

Instructions:
- Ask ONE ${selected.style}.
- Tone should be ${selected.tone}.
- Do NOT provide hints.
- Do NOT provide the answer.
- Keep the question concise.
- Make it realistic and industry-relevant.
`

    try {
        const text = await callGemini(prompt)
        res.json({ question: text || "Failed to generate question." })
    } catch (error) {
        console.error(error)
        res.json({ question: "Server error." })
    }
})

app.post("/evaluate", async (req, res) => {
    const { question, answer } = req.body

    const prompt = `
Question: ${question}
Answer: ${answer}

You are an experienced mentor giving thoughtful feedback.

Return JSON:
{
  "score": number (0-10),
  "feedback": "clear, constructive, grounded feedback"
}

Rules:
- Start with what was done well.
- Provide specific suggestions.
- Keep tone steady and calm.
- Avoid harsh criticism.
- Focus on growth and clarity.

Return JSON:
{
  "score": number (0-10),
  "feedback": "short feedback"
}
`

    try {
        const text = await callGemini(prompt)
        let cleaned = text
            ?.replace(/```json/g, "")
            .replace(/```/g, "")
            .trim()

        res.json({ result: cleaned || '{"score":5,"feedback":"Failed."}' })
    } catch (error) {
        console.error(error)
        res.json({ result: '{"score":5,"feedback":"Server error."}' })
    }
})


app.post("/upload-resume", upload.single("resume"), async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" })
        }

        const pdfData = await pdfParse(req.file.buffer)

        resumeText = pdfData.text.trim()

        console.log("Resume extracted length:", resumeText.length)

        res.json({ message: "Resume uploaded successfully" })

    } catch (error) {
        console.error("Upload error:", error)
        res.status(500).json({ error: "Failed to process resume" })
    }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})