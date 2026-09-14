# 🐾 Catmonto

> **Your intelligent, lightweight, privacy-first desktop AI cat companion.**
> Powered 100% locally by **Ollama** and local vision models (such as **Qwen2.5-VL**).

---

## 💡 What is Catmonto?

Catmonto is a small desktop AI companion represented by an animated cute cat that floats transparently on your screen. It can understand what you're currently doing on your computer and proactively provide useful suggestions through a small speech bubble.

The core principle:
$$\textbf{Observe} \longrightarrow \textbf{Understand} \longrightarrow \textbf{Decide} \longrightarrow \textbf{Suggest}$$

Catmonto is designed to feel like a helpful pair programmer and desktop friend, **NOT** surveillance software.

---

## ✨ Key Features

- 🖥️ **Transparent Always-on-Top Floating Character**: Draggable anywhere on your workspace with natural breathing, blinking, thinking, speaking, attention, and sleeping states.
- 👁️ **Eye Tracking**: Interactive eyes that subtly track your mouse cursor or focus area on screen.
- 🔒 **100% Privacy & Zero Cloud Leakage**:
  - Runs **completely offline** after model installation.
  - No external AI API (No OpenAI, No Anthropic, No Gemini API keys required).
  - No database (No Firebase, No Supabase, No MongoDB, No SQLite).
  - Screenshots are held only in volatile memory during analysis and **never permanently stored** or uploaded.
  - **Privacy Exclusion Filter**: Automatically pauses or ignores sensitive applications and keywords (e.g. banking, password managers, private chats).
- 🧠 **Smart Throttling & Change Detection**: Never spams AI calls. It computes micro-difference hashes to evaluate screen deltas and remains silent unless an action is genuinely helpful.
- 🤐 **Strict "Do Not Talk Constantly" Philosophy**: If an observation has no high-confidence actionable suggestion, Catmonto returns `NO_SUGGESTION` and stays quietly idle.
- 🇮🇳 **Automatic Multilingual Matching**:
  - Automatically replies in the user's natural language and style: **English**, **Hindi**, or **Hinglish** (e.g., *"Bhai, yaha syntax error lag raha hai. Line 24 check kar."*).
  - No manual language dropdowns needed.
- 💬 **Manual "Ask Cat"**: Click the cat or press the message icon anytime to ask direct questions about what is on your screen.

---

## 🛠️ Architecture

```text
Catmonto/
├── electron/
│   ├── main.js             # Electron main process & IPC coordinator
│   ├── preload.js          # Secure ContextBridge IPC
│   ├── capture/
│   │   └── capturer.js     # DesktopCapturer & micro-diff change detector
│   ├── ai/
│   │   ├── provider.js     # Abstract AIProvider interface
│   │   └── ollama-provider.js # Local Ollama vision engine + system prompt
│   ├── privacy/
│   │   └── exclusion.js    # Keyword & foreground app privacy exclusion
│   └── settings/
│       └── store.js        # Local JSON preferences store (userData)
│
├── src/
│   ├── components/
│   │   ├── Cat/            # Layered animated SVG cat with eye tracking
│   │   ├── SpeechBubble/   # Micro-animated bubble for suggestions
│   │   ├── AskCat/         # Minimal screen inquiry input
│   │   ├── Controls/       # Pause/Resume, status & settings toolbar
│   │   └── Settings/       # Local AI & privacy preferences modal
│   ├── App.jsx             # Main reactive shell
│   └── index.css           # Vanilla CSS design tokens & animations
│
├── .github/workflows/
│   └── build.yml           # Automated Windows CI/CD builder (Catmonto-Setup.exe)
├── package.json
└── vite.config.js
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v18 or higher (v20+ recommended)
- **Ollama**: Free, open-source local AI runtime. [Download Ollama for Windows](https://ollama.com/download/windows).

### 2. Pull a Vision Model in Ollama
Open PowerShell or Command Prompt and run:
```bash
# Recommended default model (Fast and highly accurate for vision)
ollama run qwen2.5-vl

# Or alternative lightweight models
ollama run llava
```
Verify Ollama is active by visiting `http://localhost:11434` in your browser.

### 3. Install & Run Catmonto in Development
```bash
# Clone repository
git clone https://github.com/MayankSuthar9024/Cat-Monto.git
cd Cat-Monto

# Install dependencies
npm install

# Start local dev server & desktop window
npm run start
```

### 4. Build Windows Installer (`Catmonto-Setup.exe`)
```bash
npm run dist:win
```
The installer executable will be generated inside the `dist-electron/` folder.

---

## ⚙️ Settings & Configuration

Click the gear icon on the floating toolbar to configure:
- **Ollama URL**: Default is `http://127.0.0.1:11434`.
- **Model**: Default is `qwen2.5-vl:latest`.
- **Privacy Exclusions**: Comma-separated blacklist keywords (e.g. `bitwarden, 1password, banking, paytm, private`).
- **Demo / Simulation Mode**: Toggle to test animations and suggestion bubbles without running Ollama.

---

## 🛡️ Security Best Practices
- Context isolation enabled (`contextIsolation: true`).
- Node integration disabled in renderer (`nodeIntegration: false`).
- Validated IPC message channels.
- Catmonto acts strictly as an **observer and advisor** in V1 — it never executes autonomous mouse or keyboard commands.

---

## 🗺️ Roadmap
- [x] Phase 1–3: Electron transparent desktop shell & animated Cat character
- [x] Phase 4–6: Screen capture, Ollama local vision integration & change detection
- [x] Phase 7–10: Confidence filtering, Speech bubbles, Hindi/Hinglish language matching
- [x] Phase 11–12: Privacy exclusion engine, pause controls & manual Ask Cat prompt
- [x] Phase 13–14: NSIS Windows installer & GitHub Actions CI
- [ ] V2: Voice interactions & multi-monitor focal tracking

---

## 📄 License
MIT License. Created by [Mayank Suthar](https://github.com/MayankSuthar9024).
