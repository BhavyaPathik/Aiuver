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

app.post("/questions", async (req, res) => {
  const { role, level } = req.body
  const selected = difficultyMap[level] || difficultyMap[3]

  const questionCounts = {
    1: 3,
    2: 5,
    3: 7,
    4: 10
  }

  const numQuestions = questionCounts[level] || 7

  const prompt = `
You are a strict technical interviewer. Generate exactly ${numQuestions} questions for a ${role} interview at the ${selected.label} level.

Role: ${role}
Level: ${selected.label}
Total Questions: ${numQuestions}

Instructions:
- Generate ${numQuestions} interview questions, one per line.
- Start with easier questions and progressively increase difficulty.
- Each question should demonstrate ${selected.style}.
- Use a ${selected.tone} tone.
- Do NOT provide hints or answers.
- Keep each question concise (1-2 sentences).
- Make them realistic and industry-relevant.
- Number each question: Q1, Q2, Q3, etc.

Format:
Q1: [question]
Q2: [question]
Q${numQuestions}: [question]
`

  try {
    const text = await callGemini(prompt)
    const questions = text
      .split('\n')
      .filter(line => line.match(/^Q\d+:/))
      .map((line, index) => ({
        id: index + 1,
        text: line.replace(/^Q\d+:\s*/, '').trim()
      }))
      .filter(q => q.text.length > 0)

    res.json({ questions: questions.length > 0 ? questions : [] })
  } catch (error) {
    console.error(error)
    res.json({ questions: [] })
  }
})

app.post("/question", async (req, res) => {
  const { role, level, questionNumber } = req.body
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

app.post("/generate-report", async (req, res) => {
    const { role, level, answers } = req.body
    const selected = difficultyMap[level] || difficultyMap[3]

    const totalScore = Math.round(answers.reduce((sum, a) => sum + a.score, 0) / answers.length)
    const answersSummary = answers
        .map((a, i) => `
Question ${i + 1}: ${a.question}
Answer: ${a.answer}
Score: ${a.score}/10
Feedback: ${a.feedback}`)
        .join("\n---\n")

    const prompt = `
You are an expert technical interview evaluator. Based on the interview performance below, generate a comprehensive performance report.

Role: ${role}
Level: ${selected.label}
Average Score: ${totalScore}/10
Total Questions: ${answers.length}

Interview Answers:
${answersSummary}

Create a professional HTML report with exactly these sections. Use the following exact HTML structure for each section:

<section>
<h3>📊 Overall Performance</h3>
<p>Provide overall assessment (1-2 sentences). Also return an overall score out of 10.</p>
</section>

<section>
<h3>✅ Strengths</h3>
<ul>
<li>Strength 1</li>
<li>Strength 2</li>
<li>Strength 3</li>
</ul>
</section>

<section>
<h3>🎯 Areas for Improvement</h3>
<ul>
<li>Area 1</li>
<li>Area 2</li>
<li>Area 3</li>
</ul>
</section>

<section>
<h3>💡 Key Takeaways</h3>
<ul>
<li>Takeaway 1 - specific action item</li>
<li>Takeaway 2 - specific action item</li>
</ul>
</section>

<section>
<h3>🚀 Next Steps</h3>
<p>Provide 2-3 specific recommendations for improvement and learning path.</p>
</section>

Be constructive, specific, and actionable. Focus on growth and development. Return only the HTML sections, no extra text.
`

    try {
        const text = await callGemini(prompt)
        res.json({ report: text || "Report generation failed.", score: totalScore })
    } catch (error) {
        console.error(error)
        res.json({ report: "Server error generating report.", score: 0 })
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