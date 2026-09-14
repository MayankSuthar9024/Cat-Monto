# Catmonto — Real-Time AI Desktop Coding Companion

> **A high-performance, real-time desktop AI coding companion represented by an animated virtual cat.**  
> Floating quietly on your screen, Catmonto monitors your code as you write it, detects real syntax and logic errors in under 2 seconds, and alerts you with precise line numbers, clear error explanations, and one-click copyable solutions.

---

## Architecture & Real-Time Pipeline

Catmonto features a low-latency, event-driven streaming architecture designed to achieve sub-2-second reaction times without spamming the AI or overloading your CPU/GPU:

```
+-----------------------------------------------------------------------------+
|                               USER CODING                                   |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 1. SCREEN CAPTURER (500ms sampling)                                         |
|    - Windows DesktopCapturer (Screen mode / Window mode)                    |
|    - Configurable crop region (Code editor area)                            |
|    - Downscaled to 960x540 JPEG (Quality: 72) -> 10-15ms processing        |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 2. MICRO-GRID CHANGE DETECTION (128x72)                                     |
|    - Fast bitmap difference threshold (0.6%)                                |
|    - If screen is idle/static: skips AI call entirely (0 tokens, 0ms wait)  |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 3. TYPING DEBOUNCE BUFFER (500ms)                                           |
|    - Detects rapid successive keystrokes                                    |
|    - Waits for a natural 500ms typing pause before requesting analysis      |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 4. LATEST-FRAME PRIORITY PIPELINE                                           |
|    - Stale frames are immediately discarded                                 |
|    - Only the single newest frame is processed                              |
|    - No request queuing backlog or outdated alerts                          |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 5. HIGH-SPEED GEMINI ENGINE                                                 |
|    - Primary Model: `gemini-flash-lite-latest` (1.8s median latency)        |
|    - Fallback Model: `gemini-3.5-flash`                                     |
|    - Zero thinking budget (`thinkingBudget: 0`) to eliminate wait times     |
|    - Structured JSON output (`responseMimeType: 'application/json'`)        |
|    - Gemini Live WebSocket bidirectional streaming supported                |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 6. RESPONSE VALIDATOR & ERROR FINGERPRINTING                                |
|    - Validates JSON schema: { error, severity, line, title, message, fix }  |
|    - Generates unique fingerprint: `language:line:cleanTitle:cleanMessage`  |
|    - Duplicate suppression: prevents repeat alerts for identical errors     |
|    - Fix resolution: detects when code is corrected & clears alerts         |
+-----------------------------------------------------------------------------+
                                     |
                                     v
+-----------------------------------------------------------------------------+
| 7. CAT FINITE STATE MACHINE (FSM) & UI                                      |
|    - States: IDLE, WATCHING, ANALYZING, ERROR_FOUND, EXPLAINING, SUCCESS    |
|    - Professional developer UI (Zero emojis, Plus Jakarta Sans & Inter)    |
|    - Code fix container in JetBrains Mono with 1-Click Copy button          |
+-----------------------------------------------------------------------------+
```

---

## Key Features

- **Sub-2-Second Detection**: Ultra-fast latency with `gemini-flash-lite-latest` and structured JSON streaming.
- **Accurate Line & File Tracking**: Direct visual inspection identifies the exact line number, syntax errors, missing brackets, unclosed tags, and typos.
- **Smart Duplicate Suppression**: Deterministic fingerprinting prevents nagging or repeated speech bubbles while you're still working on the same error.
- **Auto Error Dismissal**: Once you fix the error, the cat automatically enters a celebratory `SUCCESS` state, dismisses the speech bubble, and returns to sleep.
- **Typing Debounce**: Intelligent debounce buffers avoid interrupting your flow while typing.
- **Exhibition & Demo Mode**: Fast-paced presentation profile designed for live stage demos or hackathon presentations.
- **Privacy First**: Exclude sensitive applications (password managers, banking apps, private messaging) with local DPAPI encrypted API key storage.
- **Dual AI Backends**: High-speed cloud Gemini API or 100% offline local vision with Ollama (`qwen2.5-vl`).

---

## Directory Structure

```text
Cat-Monto/
├── electron/
│   ├── main.js                  # Master process & Latest-Frame Priority Pipeline
│   ├── preload.js               # Secure ContextBridge IPC bindings
│   ├── config/
│   │   └── cat-config.js        # Centralized tuning parameters & thresholds
│   ├── capture/
│   │   └── capturer.js          # Screen capture, downscaling & 128x72 change detector
│   ├── ai/
│   │   ├── gemini-provider.js   # Structured JSON Gemini engine (Flash-Lite / 3.5)
│   │   ├── gemini-live-client.js# WebSocket Live client for streaming
│   │   ├── response-validator.js# Schema validator & error fingerprint deduplication
│   │   ├── local-detector.js    # Deterministic local JS/HTML syntax checker
│   │   └── ollama-provider.js   # Local Ollama offline vision engine
│   ├── privacy/
│   │   └── exclusion.js         # Window blacklist & privacy filters
│   └── settings/
│       └── store.js             # DPAPI-encrypted preferences store
│
├── src/
│   ├── components/
│   │   ├── Cat/                 # Interactive animated cat with eye tracking
│   │   ├── SpeechBubble/        # JetBrains Mono developer card with 1-click copy
│   │   ├── AskCat/              # Quick screen query modal
│   │   └── Wizard/              # Multi-step setup & configuration wizard
│   ├── App.jsx                  # Main reactive application shell
│   └── index.css                # Polished glassmorphic dark/light styling
│
├── package.json
└── vite.config.js
```

---

## Configuration (`electron/config/cat-config.js`)

You can customize performance and thresholds directly in `cat-config.js`:

| Setting | Default | Description |
| :--- | :--- | :--- |
| `SCREEN_CAPTURE_INTERVAL_MS` | `500` | Screen capture sampling rate |
| `TYPING_DEBOUNCE_MS` | `500` | Idle pause required after typing before analysis |
| `THUMBNAIL_DIFF_THRESHOLD` | `0.006` | Micro-grid sensitivity (0.6% pixel difference) |
| `CAPTURE_MAX_WIDTH` | `960` | Max width for downscaled AI analysis frame |
| `CAPTURE_MAX_HEIGHT` | `540` | Max height for downscaled AI analysis frame |
| `JPEG_QUALITY` | `72` | JPEG compression quality for fast network transfer |
| `DUPLICATE_ERROR_SUPPRESSION_MS` | `45000` | Cooldown before re-alerting identical error |
| `PRIMARY_GEMINI_MODEL` | `gemini-flash-lite-latest` | Ultra-low latency primary model |
| `FALLBACK_GEMINI_MODEL` | `gemini-3.5-flash` | High-accuracy fallback model |
| `EXHIBITION_MODE` | `false` | Enable aggressive 300ms intervals for live demos |

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18 or higher (v20+ recommended)
- **Gemini API Key**: Free tier or paid key from [Google AI Studio](https://aistudio.google.com/)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/MayankSuthar9024/Cat-Monto.git
cd Cat-Monto

# Install dependencies
npm install
```

### 3. Running in Development
```bash
npm start
```
1. Click on the Cat to open the **Setup Wizard**.
2. Enter your **Gemini API Key** and select your model (`gemini-flash-lite-latest` recommended).
3. Select your display or target code editor window.
4. Start coding! Catmonto sleeps peacefully until a real coding error occurs.

---

## Packaging for Windows

Build the installer executable:
```bash
npm run dist:win
```
The installer executable will be generated inside the `dist-electron/` folder.

---

## License
MIT License. Created by [Mayank Suthar](https://github.com/MayankSuthar9024).
