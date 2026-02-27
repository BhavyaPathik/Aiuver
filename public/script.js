let level = 3
let currentQuestion = ""

async function startInterview() {
  const role = document.getElementById("role").value

  const res = await fetch("/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, level })
  })

  const data = await res.json()
  currentQuestion = data.question

  document.getElementById("chat").innerHTML +=
    "<p><b>Interviewer:</b> " + currentQuestion + "</p>"
}

async function sendAnswer() {
  const answerInput = document.getElementById("answer")
  const answer = answerInput.value
  answerInput.value = ""

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
}
async function uploadResume() {
  const fileInput = document.getElementById("resumeInput")
  const file = fileInput.files[0]

  if (!file) {
    alert("Please choose a PDF first.")
    return
  }

  const formData = new FormData()
  formData.append("resume", file)

  const res = await fetch("/upload-resume", {
    method: "POST",
    body: formData
  })

  if (res.ok) {
    alert("Resume uploaded successfully!")
  } else {
    alert("Upload failed.")
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
    await uploadResume()
    startBtn.disabled = false
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