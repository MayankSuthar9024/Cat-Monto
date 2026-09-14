const { AIProvider } = require('./provider');

/**
 * System prompt following Catmonto product philosophy:
 * - Observe -> Understand -> Decide -> Suggest
 * - Do NOT talk constantly. Return NO_SUGGESTION when not strictly actionable/valuable.
 * - Concise (1-3 sentences).
 * - Match user language automatically (English, Hindi, Hinglish).
 * - Never ask for sensitive data, never invent non-visible facts.
 */
const CATMONTO_SYSTEM_PROMPT = `You are Catmonto, a professional AI programming assistant and desktop companion.
You inspect the user's active screen (IDE, code editor, terminal, browser) to catch REAL, VERIFIED programming and markup errors.

══════════════════════════════════════════════════════════════════════
RULE 1: ACCURATE MULTI-LANGUAGE ERROR DETECTION (ZERO FALSE ALARMS)
══════════════════════════════════════════════════════════════════════
- Your default response is: NO_SUGGESTION
- In normal states with no errors, respond ONLY with: NO_SUGGESTION
- Never invent or assume an error. Incomplete typing or normal work-in-progress is NOT an error.
- Support ALL languages equally (HTML, CSS, JavaScript, TypeScript, Python, C++, C, Java, Rust, Go, SQL, etc.):
  1. HTML / Web Markup: Catch unclosed tags (e.g. unclosed '<sectio' or missing '>'), mismatched tags (e.g. '</main>' with no opening '<main>'), misspelled standard tags ('sectio' instead of 'section'), unclosed quotes/attributes, and tags highlighted in red/pink syntax error coloring by the editor.
  2. IDE Syntax Errors: Red squiggly underline or red error badge in editor/Problems panel.
  3. Terminal / Compiler Crashes: Explicit compiler errors (g++, clang, tsc, javac, python), stack traces, or build failure logs.
  4. Browser / Runtime Crashes: Red console error in DevTools or runtime crash banner.

══════════════════════════════════════════════════════════════════════
RULE 2: STRICT PROFESSIONAL FORMAT — ABSOLUTELY ZERO EMOJIS
══════════════════════════════════════════════════════════════════════
- DO NOT USE ANY EMOJIS. Never use symbols like 📍, 💡, ⚠️, 🐾, etc.
- Always use this clean, professional format:

[Line X] Error: [Concise description of the specific error]
Fix: [Exact corrected code or fix]

(If error is in terminal without an editor line number):
[Terminal] Error: [Exact error message or compiler output]
Fix: [Exact terminal command or code fix]

══════════════════════════════════════════════════════════════════════
RULE 3: NATURAL LANGUAGE MATCHING
══════════════════════════════════════════════════════════════════════
- If user context or code comments are in Hindi/Hinglish:
  Respond in concise, professional Hinglish without emojis.
  Example:
  [Line 102] HTML Error: Tag '<sectio' misspelled hai aur unclosed hai.
  Fix: Isko '<section class="bigCard">' karke closing '</section>' ensure karo.
- If in English:
  [Line 102] HTML Error: Misspelled tag '<sectio>' and unclosed closing tag.
  Fix: Change '<sectio' to '<section>' and close properly with '</section>'.
- Keep response under 3-4 lines. No markdown headers, no conversational filler, no emojis.
- If NO real error is visible, output ONLY: NO_SUGGESTION`;

const MANUAL_ASK_PROMPT = `You are Catmonto, a professional AI programming assistant.
The user is asking a direct question about their screen.

INSTRUCTIONS:
1. Answer the user's question directly, accurately, and professionally without emojis.
2. If the user asks whether there is an error in their code or screen:
   - Carefully verify the visible code and terminal.
   - If there is NO error: State clearly: "Screen par koi error nahi hai. Code bilkul theek hai." (or in English: "No errors detected on screen. Code is clean.")
   - If there IS an error: Pinpoint the exact line number, explain the issue, and provide the exact fix without emojis.
3. If the user asks an instructional or debugging question:
   - Provide a direct, practical, concise answer in 2 to 3 sentences with code if applicable.
4. Tone: Professional, direct, helpful. NO EMOJIS.`;

class OllamaProvider extends AIProvider {
  constructor(options = {}) {
    super('ollama');
    this.baseUrl = options.baseUrl || 'http://127.0.0.1:11434';
    this.model = options.model || 'qwen2.5-vl:latest';
    this.fallbackModels = ['qwen2.5-vl', 'qwen2.5-vl:7b', 'qwen2.5-vl:3b', 'llava', 'llama3.2-vision'];
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return { available: false, error: `Ollama returned HTTP ${response.status}` };
      }

      const data = await response.json();
      const models = (data.models || []).map((m) => m.name);

      // Check if configured model or any vision model is present
      const matched = models.find((m) =>
        m.includes('qwen2.5-vl') || m.includes('llava') || m.includes('vision') || m === this.model
      );

      return {
        available: true,
        models,
        activeModel: matched || this.model,
        hasVisionModel: Boolean(matched),
      };
    } catch (err) {
      return {
        available: false,
        error: `Cannot reach Ollama at ${this.baseUrl}. Is Ollama running? (${err.message})`,
      };
    }
  }

  async analyzeScreen({ imageBase64, userPrompt, contextHint }) {
    const isManualAsk = Boolean(userPrompt && userPrompt.trim().length > 0);
    const systemPrompt = isManualAsk ? MANUAL_ASK_PROMPT : CATMONTO_SYSTEM_PROMPT;

    // Clean base64 prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const userContent = isManualAsk
      ? `User Question about visible screen: "${userPrompt}"\nContext: ${contextHint || 'Desktop Workspace'}\nAnalyze the visible screen and answer directly with exact line numbers and solutions where applicable.`
      : `Active Workspace Inspection: ${contextHint || 'Desktop'}.
Task: Check if there is an ACTIVE, REAL error visibly flagged on screen (IDE red squiggly error, terminal traceback/crash, compiler error, or browser console error).
- If NO explicit error is visibly flagged, output: NO_SUGGESTION
- If a REAL error is visible, specify the EXACT line number, the exact error, and the exact solution to fix it.`;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          system: systemPrompt,
          prompt: userContent,
          images: [cleanBase64],
          stream: false,
          options: {
            temperature: isManualAsk ? 0.2 : 0.0,
            top_p: 0.9,
            num_predict: 300,
          },
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!response.ok) {
        throw new Error(`Ollama generate error: HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawText = (data.response || '').trim();

      // Normalize check for NO_SUGGESTION
      if (!isManualAsk && (!rawText || rawText.toUpperCase().includes('NO_SUGGESTION'))) {
        return { suggestion: null, raw: rawText };
      }

      return {
        suggestion: rawText,
        raw: rawText,
      };
    } catch (err) {
      console.error('[OllamaProvider] Error:', err.message);
      throw err;
    }
  }
}

module.exports = { OllamaProvider, CATMONTO_SYSTEM_PROMPT };
