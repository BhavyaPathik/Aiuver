let currentQuestion = ""
let currentLevel = 3
let questionCount = 0
let maxQuestions = 7
let questionsList = []
let currentRole = ""
let interviewAnswers = []
let isSpeaking = false
let currentSpeech = null

// timer
let timerId = null
let timeRemaining = 0

// persistence
function saveState() {
  const state = {
    currentQuestion,
    currentLevel,
    questionCount,
    maxQuestions,
    questionsList,
    currentRole,
    interviewAnswers,
    timeRemaining
  }
  localStorage.setItem('interviewState', JSON.stringify(state))
}

function loadState() {
  const s = localStorage.getItem('interviewState')
  if (s) {
    try {
      const st = JSON.parse(s)
      currentQuestion = st.currentQuestion || ''
      currentLevel = st.currentLevel || 3
      questionCount = st.questionCount || 0
      maxQuestions = st.maxQuestions || 7
      questionsList = st.questionsList || []
      currentRole = st.currentRole || ''
      interviewAnswers = st.interviewAnswers || []
      timeRemaining = st.timeRemaining || 0
      // restore chat HTML
      if (st.chatHTML) {
        document.getElementById('chat').innerHTML = st.chatHTML
      }
      return true
    } catch {}
  }
  return false
}

function clearState() {
  localStorage.removeItem('interviewState')
}

// timer helpers
function startTimer() {
  stopTimer()
  updateTimerDisplay()
  timerId = setInterval(() => {
    if (timeRemaining > 0) {
      timeRemaining--
      updateTimerDisplay()
      saveState()
    } else {
      stopTimer()
      document.getElementById('chat').innerHTML += "<p><b>⏰ Time's up!</b> Interview paused.</p>"
    }
  }, 1000)
}

function stopTimer() {
  if (timerId) clearInterval(timerId)
  timerId = null
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay')
  if (!display) return
  if (timeRemaining > 0) {
    const mins = Math.floor(timeRemaining/60)
    const secs = timeRemaining%60
    display.textContent = `${mins}:${secs.toString().padStart(2,'0')}`
  } else {
    display.textContent = ''
  }
}




async function startInterview() {
  const role = document.getElementById("role").value
  currentRole = role
  currentLevel = parseInt(document.getElementById("level").value)

  // check time limit input
  const timeInput = document.getElementById('timeLimit')
  if (timeInput && parseInt(timeInput.value) > 0) {
    timeRemaining = parseInt(timeInput.value) * 60 // seconds
    startTimer()
  } else {
    timeRemaining = 0
    stopTimer()
  }

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
  saveState()
  askQuestion()
}

async function askQuestion() {
  if (questionCount >= questionsList.length) {
    document.getElementById("chat").innerHTML +=
      "<p><b>Interview Complete 🎉</b></p>"
    saveState()
    return
  }

  currentQuestion = questionsList[questionCount].text
  questionCount++

  const questionHTML = `
    <div style="display: flex; align-items: flex-start; gap: 10px;">
      <button onclick="speakQuestion()" style="
        background: #667eea;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        margin-top: 5px;
      " id="voiceBtn">🔊 Hear</button>
      <div>
        <p><b>Question ${questionCount}/${questionsList.length}:</b></p>
        <p><b>Interviewer:</b> ${currentQuestion}</p>
      </div>
    </div>
  `

  document.getElementById("chat").innerHTML += questionHTML
  scrollToChat()
  saveState()
}

function speakQuestion() {
  if (!('speechSynthesis' in window)) {
    alert('Voice feature is not supported in your browser')
    return
  }

  const btn = document.getElementById('voiceBtn')

  if (isSpeaking) {
    window.speechSynthesis.cancel()
    isSpeaking = false
    btn.textContent = '🔊 Hear'
    return
  }

  const utterance = new SpeechSynthesisUtterance(currentQuestion)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 1

  utterance.onstart = () => {
    isSpeaking = true
    btn.textContent = '⏸ Stop'
  }

  utterance.onend = () => {
    isSpeaking = false
    btn.textContent = '🔊 Hear'
  }

  window.speechSynthesis.speak(utterance)
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
  const roadmap = data.roadmap || ""
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

  // if the server provided a separate roadmap, display it below
  if (roadmap) {
    document.getElementById("chat").innerHTML +=
      `<div class="roadmap-section">${roadmap}</div>`
  }

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
  saveState()

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
  // mark active nav link
  const links = document.querySelectorAll('.nav-links a');
  links.forEach(a => {
    if (a.href === window.location.href || a.href === window.location.href.split('?')[0]) {
      a.classList.add('active');
    }
  });


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

  // BROWSE (only on home page)
  if (browseBtn) {
    browseBtn.addEventListener("click", () => {
      resumeInput.click()
    })
  }

  // SHOW FILE AFTER MANUAL SELECT
  if (resumeInput) {
    resumeInput.addEventListener("change", () => {
      const file = resumeInput.files[0]
      if (file) {
        showSelectedFile(file)
      }
    })
  }

  // DRAG EVENTS (only on home page)
  if (dropZone) {
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
  }

  // UPLOAD (only on home page)
  if (uploadBtn) {
    uploadBtn.addEventListener("click", async () => {
      const success = await uploadResume()

      if (success) {
        startBtn.disabled = false
      }
    })
  }

  // LOAD persisted interview if available (only on home page)
  if (startBtn && loadState()) {
    if (questionsList.length > 0 && questionCount < questionsList.length) {
      document.querySelector('.interview-section').scrollIntoView({behavior:'smooth'})
      if (timeRemaining > 0) startTimer()
      // restore time limit field
      const timeInput = document.getElementById('timeLimit')
      if (timeInput) timeInput.value = Math.ceil(timeRemaining/60)
      askQuestion()
    }
  }

  // START INTERVIEW WITH SCROLL (only on home page)
  if (startBtn) {
    startBtn.addEventListener("click", async () => {

      if (startBtn.disabled) return

      document.querySelector(".interview-section").scrollIntoView({
        behavior: "smooth"
      })

      setTimeout(() => {
        startInterview()
      }, 400)
    })
  }

  // REFRESH BUTTON
  const refreshBtn = document.getElementById('refreshBtn')
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      clearState()
      location.reload()
    })
  }

  // ANSWER INPUT ENTER KEY
  const answerInput = document.getElementById("answer")
  if (answerInput) {
    answerInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        sendAnswer()
      }
    })
  }

  // VOICE ANSWER BUTTON
  const voiceBtn = document.getElementById('voiceAnswerBtn')
  if (voiceBtn) {
    voiceBtn.addEventListener('click', (e) => {
      e.preventDefault()
      toggleRecording()
    })
  }

  // RESUME REVIEW section (resources page)
  const reviewBrowseBtn = document.getElementById('reviewBrowseBtn')
  const reviewResumeInput = document.getElementById('reviewResumeInput')
  const reviewDropZone = document.getElementById('reviewDropZone')
  const reviewBtn = document.getElementById('reviewBtn')
  const reviewResult = document.getElementById('reviewResult')

  if (reviewBrowseBtn) {
    reviewBrowseBtn.addEventListener('click', () => {
      reviewResumeInput.click()
    })
  }

  if (reviewResumeInput) {
    reviewResumeInput.addEventListener('change', () => {
      const file = reviewResumeInput.files[0]
      if (file && file.type === 'application/pdf') {
        reviewBtn.disabled = false
        showReviewFile(file)
      } else {
        alert('Please upload a PDF file.')
        reviewResumeInput.value = ''
        reviewBtn.disabled = true
      }
    })
  }

  if (reviewDropZone) {
    reviewDropZone.addEventListener('dragover', (e) => {
      e.preventDefault()
      reviewDropZone.classList.add('dragover')
    })
    reviewDropZone.addEventListener('dragleave', () => {
      reviewDropZone.classList.remove('dragover')
    })
    reviewDropZone.addEventListener('drop', (e) => {
      e.preventDefault()
      reviewDropZone.classList.remove('dragover')
      const file = e.dataTransfer.files[0]
      if (!file || file.type !== 'application/pdf') {
        alert('Please upload a PDF file.')
        return
      }
      reviewResumeInput.files = e.dataTransfer.files
      reviewBtn.disabled = false
      showReviewFile(file)
    })
  }

  if (reviewBtn) {
    reviewBtn.addEventListener('click', async () => {
      const file = reviewResumeInput.files[0]
      if (!file) {
        alert('Please select a resume first.')
        return
      }
      reviewBtn.disabled = true
      reviewResult.innerHTML = '<p style="text-align:center;opacity:0.7;">Analyzing resume...</p>'

      const formData = new FormData()
      formData.append('resume', file)

      try {
        const res = await fetch('/evaluate-resume', {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          const data = await res.json()
          reviewResult.innerHTML = data.result || '<p>No feedback returned.</p>'
          // scroll to result
          setTimeout(() => {
            reviewResult.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        } else {
          reviewResult.innerHTML = '<p style="color: #ef4444; text-align: center;">Error analyzing resume. Please try again.</p>'
        }
      } catch (err) {
        console.error('Upload error:', err)
        reviewResult.innerHTML = '<p>Error connecting to server.</p>'
      }
      reviewBtn.disabled = false
    })
  }

})

// -------- SHOW REVIEW FILE UI --------
function showReviewFile(file) {
  const reviewDropZone = document.getElementById('reviewDropZone')
  if (reviewDropZone) {
    const dropArea = reviewDropZone.querySelector('.drop-area')
    if (dropArea) {
      dropArea.innerHTML = `
        <p style="color:#6A5AE0; font-weight:600;">
           ${file.name}
        </p>
        <p class="drop-sub">File ready</p>
      `
    }
  }
}