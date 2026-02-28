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

  const resumeContext = resumeText ? `\nCandidate Resume:\n${resumeText.substring(0, 1500)}` : ""

  const prompt = `
You are a strict technical interviewer. Generate exactly ${numQuestions} personalized questions for a ${role} interview at the ${selected.label} level.${resumeContext}

Role: ${role}
Level: ${selected.label}
Total Questions: ${numQuestions}

Instructions:
- Generate ${numQuestions} interview questions based on the candidate's resume and experience.
- Ask about their specific projects, technologies, and skills from their resume.
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

You are a thoughtful technical mentor providing conversational feedback.

Return JSON with score (0-10) and feedback as natural conversational text.

Feedback Rules:
- Write like talking to a colleague, no bullet points or asterisks
- Highlight what was done well first
- Ask thoughtful questions about areas that could improve
- Suggest specific topics or approaches to explore
- Keep it 2-3 sentences, supportive and constructive
- No dashes, no special formatting, plain text only
- Return only valid JSON with no code blocks
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
    const scores = answers.map(a => a.score)
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    
    // Create performance chart data
    const chartHTML = `
    <section style="margin: 20px 0;">
      <h3>Performance Progression</h3>
      <div style="display: flex; gap: 15px; align-items: flex-end; height: 200px; background: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 15px;">
        ${answers.map((a, i) => `
          <div style="flex: 1; text-align: center;">
            <div style="background: ${a.score >= 8 ? '#10b981' : a.score >= 6 ? '#f59e0b' : '#ef4444'}; height: ${(a.score / 10) * 150}px; border-radius: 6px; margin-bottom: 10px;"></div>
            <p style="font-size: 12px; color: #666; margin: 0; font-weight: 600;">Q${i + 1}</p>
            <p style="font-size: 11px; color: #999; margin: 0;">${a.score}/10</p>
          </div>
        `).join('')}
      </div>
      <div style="display: flex; justify-content: space-around; margin-top: 15px; padding: 15px 0; border-top: 1px solid #e5e7eb;">
        <div style="text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #666;">Highest Score</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #10b981;">${maxScore}/10</p>
        </div>
        <div style="text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #666;">Lowest Score</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #ef4444;">${minScore}/10</p>
        </div>
        <div style="text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #666;">Average Score</p>
          <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: bold; color: #667eea;">${totalScore}/10</p>
        </div>
      </div>
    </section>
    `

    const answersSummary = answers
        .map((a, i) => `
Question ${i + 1}: ${a.question}
Answer: ${a.answer}
Score: ${a.score}/10
Feedback: ${a.feedback}`)
        .join("\n---\n")

    const prompt = `
You are an expert technical interview evaluator. Based on the interview performance below plus the candidate's resume, generate a comprehensive performance report.

Role: ${role}
Level: ${selected.label}
Average Score: ${totalScore}/10
Total Questions: ${answers.length}

Interview Answers:
${answersSummary}

Create a professional HTML report with exactly these sections. Use the following exact HTML structure for each section:

<section>
<h3>Overall Performance</h3>
<p>Provide overall assessment (1-2 sentences). Also return an overall score out of 10.</p>
</section>

<section>
<h3>Strengths</h3>
<ul>
<li>Strength 1</li>
<li>Strength 2</li>
<li>Strength 3</li>
</ul>
</section>

<section>
<h3>Areas for Improvement</h3>
<ul>
<li>Area 1</li>
<li>Area 2</li>
<li>Area 3</li>
</ul>
</section>

<section>
<h3>Key Takeaways</h3>
<ul>
<li>Takeaway 1 - specific action item</li>
<li>Takeaway 2 - specific action item</li>
</ul>
</section>

<section>
<h3>Next Steps</h3>
<p>Provide 2-3 specific recommendations for improvement and learning path.</p>
</section>

<section>
<h3>Personalized Roadmap</h3>
<p>Based on the resume and performance, outline a clear roadmap of topics to study next, with suggested order and resources.</p>
</section>

Be constructive, specific, and actionable. Focus on growth and development. Return only the HTML sections, no extra text.
`

    try {
        const text = await callGemini(prompt)
        // separate out the roadmap section so it can be displayed independently
        const roadmapRegex = /<section>[\s\S]*?<h3>Personalized Roadmap[\s\S]*?<\/section>/
        const roadmapMatch = text.match(roadmapRegex)
        const roadmap = roadmapMatch ? roadmapMatch[0] : ""
        const reportWithoutRoadmap = roadmap ? text.replace(roadmapRegex, "") : text
        res.json({ report: chartHTML + reportWithoutRoadmap || "Report generation failed.", roadmap, score: totalScore })
    } catch (error) {
        console.error(error)
        res.json({ report: chartHTML + "<p>Error generating detailed report.</p>" || "Server error generating report.", roadmap: "", score: totalScore })
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


// analyze a resume file and provide improvement suggestions
app.post("/evaluate-resume", upload.single("resume"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" })
        }
        const pdfData = await pdfParse(req.file.buffer)
        const resumeText = pdfData.text.trim()

        const prompt = `
You are an expert resume reviewer and career coach. Analyze this resume comprehensively and provide detailed, actionable feedback.

Return your analysis in the following HTML format exactly. Use proper HTML structure.

<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 12px; color: white; margin-bottom: 20px;">
  <h3 style="margin-top: 0; margin-bottom: 10px; font-size: 22px;">📄 Resume Analysis Report</h3>
  <p style="margin: 0; opacity: 0.9;">AI-powered feedback to enhance your resume</p>
</div>

<div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #10b981; margin-bottom: 15px;">
  <h4 style="margin-top: 0; color: #10b981;">✅ Strengths</h4>
  <ul style="margin: 10px 0; padding-left: 20px;">
    <li>List 2-3 specific strengths from the resume</li>
  </ul>
</div>

<div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b; margin-bottom: 15px;">
  <h4 style="margin-top: 0; color: #f59e0b;">⚠️ Areas to Improve</h4>
  <ul style="margin: 10px 0; padding-left: 20px;">
    <li>List specific areas that need improvement (formatting, clarity, content gaps, etc.)</li>
  </ul>
</div>

<div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #ef4444; margin-bottom: 15px;">
  <h4 style="margin-top: 0; color: #ef4444;">🔍 Skills & Experience Gap Analysis</h4>
  <ul style="margin: 10px 0; padding-left: 20px;">
    <li>Identify missing technical skills that are important for the role</li>
    <li>Highlight experience gaps that should be addressed</li>
  </ul>
</div>

<div style="background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #667eea; margin-bottom: 15px;">
  <h4 style="margin-top: 0; color: #667eea;">💡 Specific Recommendations</h4>
  <ul style="margin: 10px 0; padding-left: 20px;">
    <li>Concrete actionable steps to improve the resume</li>
    <li>Examples of better phrasing or formatting for key sections</li>
    <li>Keywords and skills to highlight</li>
  </ul>
</div>

<div style="background: #f0f4ff; padding: 20px; border-radius: 12px; border-left: 4px solid #667eea;">
  <h4 style="margin-top: 0; color: #1f2937;">🚀 Next Steps for Career Growth</h4>
  <ul style="margin: 10px 0; padding-left: 20px;">
    <li>Suggest skills to develop or certifications to pursue</li>
    <li>Recommend ways to strengthen application competitiveness</li>
    <li>Timeline for improvements</li>
  </ul>
</div>

Resume text to analyze:
${resumeText}
`;

        const feedback = await callGemini(prompt)
        // strip any code fences just in case
        const cleaned = feedback.replace(/```html/g, "").replace(/```/g, "").trim()

        res.json({ result: cleaned })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: "Failed to analyze resume" })
    }
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})

// generate two follow-up questions based on the candidate's answer
app.post("/followups", async (req, res) => {
  const { question, answer } = req.body

  const prompt = `
You are a thoughtful technical interviewer. Given the interview question and the candidate's answer below, generate exactly TWO concise follow-up questions that probe deeper, ask for clarification, or request a concrete example.

Question: ${question}
Answer: ${answer}

Instructions:
- Provide exactly 2 follow-up questions.
- Keep them short (one sentence each).
- Do NOT provide answers or commentary, return only the questions on separate lines.
`

  try {
    const text = await callGemini(prompt)
    let followUps = []

    const raw = (text || "").trim()

    // Try parse JSON array first
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        followUps = parsed.map(s => String(s).trim()).filter(Boolean)
      }
    } catch (e) {
      // not JSON, continue
    }

    // If not JSON, split by lines and numbered prefixes
    if (followUps.length === 0) {
      const lines = raw.split(/\r?\n/).map(l => l.replace(/^\s*\d+\.|^Q\d+:|^\-|^\*\s*/i, '').trim()).filter(Boolean)
      followUps = lines
    }

    // If still empty, extract sentences that end with a question mark
    if (followUps.length === 0) {
      const sentenceRegex = /[^.?!\n]+\?/g
      const matches = raw.match(sentenceRegex) || []
      followUps = matches.map(s => s.trim())
    }

    // As a last resort, fall back to splitting on common separators
    if (followUps.length === 0 && raw.length > 0) {
      const parts = raw.split(/\?|;|\n/).map(p => p.trim()).filter(Boolean)
      followUps = parts.map(p => p.endsWith('?') ? p : p + '?')
    }

    // Clean and return at most 2 follow-ups
    followUps = followUps.map(f => f.replace(/^"|"$/g, '').trim()).filter(Boolean).slice(0,2)

    res.json({ followUps })
  } catch (error) {
    console.error(error)
    res.json({ followUps: [] })
  }
})