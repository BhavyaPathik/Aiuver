let currentQuestion = ""
let currentLevel = 3
let questionCount = 0
let maxQuestions = 7
let questionsList = []
let currentRole = ""
let interviewAnswers = []

async function startInterview() {
  const role = document.getElementById("role").value
  currentRole = role
  currentLevel = parseInt(document.getElementById("level").value)

  const levelConfig = {
    1: 3,
    2: 5,
    3: 7,
    4: 10
  }

  maxQuestions = levelConfig[currentLevel]
  questionCount = 0
  questionsList = []
  interviewAnswers = []

  document.getElementById("chat").innerHTML = ""

  // Show loading message
  document.getElementById("chat").innerHTML +=
    "<p><i>Generating personalized interview questions...</i></p>"

  // Fetch all questions at once
  const res = await fetch("/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role,
      level: currentLevel
    })
  })

  const data = await res.json()
  questionsList = data.questions || []

  if (questionsList.length === 0) {
    document.getElementById("chat").innerHTML +=
      "<p>Error generating questions. Please try again.</p>"
    return
  }

  // Clear and start
  document.getElementById("chat").innerHTML = ""
  askQuestion()
}

async function askQuestion() {
  if (questionCount >= questionsList.length) {
    document.getElementById("chat").innerHTML +=
      "<p><b>Interview Complete 🎉</b></p>"
    return
  }

  currentQuestion = questionsList[questionCount].text
  questionCount++

  document.getElementById("chat").innerHTML +=
    "<p><b>Question " + questionCount + "/" + questionsList.length + ":</b></p>" +
    "<p><b>Interviewer:</b> " + currentQuestion + "</p>"

  scrollToChat()
}

async function generateReport() {
  document.getElementById("chat").innerHTML +=
    "<hr style='margin: 20px 0; border: none; border-top: 1px solid #ddd;'>"
  document.getElementById("chat").innerHTML +=
    "<p style='text-align: center; font-style: italic; color: #666;'><i>🤖 AI is analyzing your performance...</i></p>"

  const res = await fetch("/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: currentRole,
      level: currentLevel,
      answers: interviewAnswers
    })
  })

  const data = await res.json()
  const report = data.report || "Could not generate report."
  const score = data.score || 0

  const scoreColor = score >= 8 ? "#10b981" : score >= 6 ? "#f59e0b" : "#ef4444"
  const scoreLabel = score >= 8 ? "Excellent" : score >= 6 ? "Good" : "Needs Work"

  const reportHTML = `
    <div style="margin-top: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white;">
      <h2 style="margin: 0 0 10px 0; font-size: 24px; text-align: center;">📋 Your Interview Report</h2>
      
      <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 15px 0; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 14px; opacity: 0.9;">Overall Performance</p>
        <div style="font-size: 48px; font-weight: bold; margin: 10px 0;">${score}/10</div>
        <p style="margin: 0; font-size: 16px; font-weight: 600; color: #${scoreColor === '#10b981' ? '10b981' : scoreColor === '#f59e0b' ? 'f59e0b' : 'ef4444'};">${scoreLabel}</p>
      </div>
    </div>

    <div style="margin-top: 20px; background: white; padding: 20px; border-radius: 12px; border-left: 4px solid #667eea;">
      ${report}
    </div>

    <style>
      .report-section {
        margin: 20px 0;
        padding: 15px;
        background: #f9fafb;
        border-radius: 8px;
        border-left: 4px solid #667eea;
      }
      .report-section h3 {
        margin: 0 0 12px 0;
        color: #1f2937;
        font-size: 18px;
      }
      .report-section ul {
        margin: 10px 0;
        padding-left: 20px;
      }
      .report-section li {
        margin: 8px 0;
        color: #374151;
        line-height: 1.6;
      }
      .report-section p {
        margin: 10px 0;
        color: #374151;
        line-height: 1.6;
      }
    </style>
  `

  document.getElementById("chat").innerHTML += reportHTML
  scrollToChat()
}

async function sendAnswer() {
  const answerInput = document.getElementById("answer")
  const answer = answerInput.value
  
  if (!answer.trim()) return
  
  answerInput.value = ""
  answerInput.disabled = true

  document.getElementById("chat").innerHTML +=
    "<p><b>You:</b> " + answer + "</p>"

  const res = await fetch("/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: currentQuestion,
      answer: answer
    })
  })

  const data = await res.json()

  let parsed

  try {
    parsed = JSON.parse(data.result)
  } catch {
    parsed = { score: 5, feedback: data.result }
  }

  document.getElementById("chat").innerHTML +=
    "<p><b>Score:</b> " + parsed.score + "/10</p>"
  document.getElementById("chat").innerHTML +=
    "<p><b>Feedback:</b> " + parsed.feedback + "</p>"

  // Store answer data
  interviewAnswers.push({
    question: currentQuestion,
    answer: answer,
    score: parsed.score,
    feedback: parsed.feedback
  })

  setTimeout(() => {
    if (questionCount < questionsList.length) {
      document.getElementById("chat").innerHTML +=
        "<hr style='margin: 20px 0; border: none; border-top: 1px solid #ddd;'>"
      askQuestion()
    } else {
      generateReport()
    }
    answerInput.disabled = false
  }, 500)
}
function scrollToChat() {
  document.getElementById("chat").scrollIntoView({
    behavior: "smooth"
  })
}
// upload document
async function uploadResume() {
  const fileInput = document.getElementById("resumeInput")
  const file = fileInput.files[0]

  if (!file) {
    alert("Please choose a PDF first.")
    return false
  }

  const formData = new FormData()
  formData.append("resume", file)

  const res = await fetch("/upload-resume", {
    method: "POST",
    body: formData
  })

  if (res.ok) {
    return true
  } else {
    alert("Upload failed.")
    return false
  }
}
document.addEventListener("DOMContentLoaded", () => {

  const browseBtn = document.getElementById("browseBtn")
  const uploadBtn = document.getElementById("uploadBtn")
  const startBtn = document.getElementById("startBtn")
  const resumeInput = document.getElementById("resumeInput")
  const dropZone = document.getElementById("dropZone")
  const scrollBtn = document.getElementById("scrollToUpload")

  // HERO SCROLL
  if (scrollBtn) {
    scrollBtn.addEventListener("click", () => {
      document.getElementById("uploadSection").scrollIntoView({
        behavior: "smooth"
      })
    })
  }

  // BROWSE
  browseBtn.addEventListener("click", () => {
    resumeInput.click()
  })

  // SHOW FILE AFTER MANUAL SELECT
  resumeInput.addEventListener("change", () => {
    const file = resumeInput.files[0]
    if (file) {
      showSelectedFile(file)
    }
  })

  // DRAG EVENTS
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault()
    dropZone.classList.add("dragover")
  })

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover")
  })

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault()
    dropZone.classList.remove("dragover")

    const file = e.dataTransfer.files[0]

    if (!file || file.type !== "application/pdf") {
      alert("Please upload a PDF file.")
      return
    }

    resumeInput.files = e.dataTransfer.files
    showSelectedFile(file)
  })

  // UPLOAD
  uploadBtn.addEventListener("click", async () => {
    const success = await uploadResume()

    if (success) {
      startBtn.disabled = false
    }
  })

  // START INTERVIEW WITH SCROLL
  startBtn.addEventListener("click", async () => {

    if (startBtn.disabled) return

    document.querySelector(".interview-section").scrollIntoView({
      behavior: "smooth"
    })

    setTimeout(() => {
      startInterview()
    }, 400)
  })

})

// -------- SHOW FILE UI --------
function showSelectedFile(file) {
  const dropArea = document.querySelector(".drop-area")

  dropArea.innerHTML = `
    <p style="color:#6A5AE0; font-weight:600;">
       ${file.name}
    </p>
    <p class="drop-sub">File ready</p>
  `
}


// -------- HANDLE MANUAL BROWSE --------
if (resumeInput) {
  resumeInput.addEventListener("change", () => {
    const file = resumeInput.files[0]
    if (file) {
      showSelectedFile(file)
    }
  })
}