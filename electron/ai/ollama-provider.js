const { AIProvider } = require('./provider');

/**
 * System prompt following Catmonto product philosophy:
 * - Observe -> Understand -> Decide -> Suggest
 * - Do NOT talk constantly. Return NO_SUGGESTION when not strictly actionable/valuable.
 * - Concise (1-3 sentences).
 * - Match user language automatically (English, Hindi, Hinglish).
 * - Never ask for sensitive data, never invent non-visible facts.
 */
const CATMONTO_SYSTEM_PROMPT = `You are Catmonto, a real-time AI code error detector.
Your job: scan the screen RIGHT NOW and flag any visible error instantly.

DETECT ANY OF THESE - REPORT IMMEDIATELY:
1. IDE RED SQUIGGLES / ERROR UNDERLINES on any completed line
   - Syntax errors already highlighted by the editor on lines the user already wrote
   - Even if user is typing on another line - squiggles on OTHER lines are REAL errors
2. MISSING CLOSING BRACKETS/TAGS on finished lines:
   - HTML: <div>, <section>, <ul>, <li>, <p> etc. without matching closing tags
   - C/C++: missing }, ), ; on lines already written
   - JS/TS: missing }, ), ] on completed blocks
   - Python: indentation errors visible in editor
3. TERMINAL ERRORS: compiler output, stack trace, build failure, runtime crash
4. BROWSER CONSOLE ERRORS: red text, uncaught exceptions, 404s
5. VARIABLES: declared but value never assigned before use (if editor highlights)

ONLY output NO_SUGGESTION when:
- The screen has NO errors at all - clean code
- The ONLY issue visible is incomplete text on the EXACT LINE where cursor is blinking right now
  (user is mid-typing that line - all OTHER already-written lines are fair game)

OUTPUT FORMAT (ultra concise, zero emojis):
[Line X] Error: <what is wrong>
Fix: <exact code fix>

Terminal: [Terminal] Error: <message> / Fix: <command>
Max 3 lines. Match user language (English/Hindi/Hinglish).`;

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
      ? `User Question: "${userPrompt}"\nContext: ${contextHint || 'Desktop Workspace'}\nAnswer directly with exact line numbers and solutions. No emojis.`
      : `Real-time scan of: ${contextHint || 'Desktop'}.
Look for ANY error on screen RIGHT NOW:
- IDE red squiggles or underlines on already-written lines (report even if user is typing on another line)
- Missing closing tags/brackets on finished code lines
- Terminal: compiler errors, tracebacks
- Browser: console errors
Only skip if screen is clean OR only the cursor's current active line is incomplete.
Report instantly. NO_SUGGESTION only if truly nothing wrong.`;

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
            // 150 tokens is plenty for a 3-line error report — faster inference
            num_predict: isManualAsk ? 300 : 150,
          },
        }),
        // 18s timeout: local models can be slower but still need a cap
        signal: AbortSignal.timeout(18000),
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
