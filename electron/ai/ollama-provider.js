const { AIProvider } = require('./provider');

/**
 * System prompt following Catmonto product philosophy:
 * - Observe -> Understand -> Decide -> Suggest
 * - Do NOT talk constantly. Return NO_SUGGESTION when not strictly actionable/valuable.
 * - Concise (1-3 sentences).
 * - Match user language automatically (English, Hindi, Hinglish).
 * - Never ask for sensitive data, never invent non-visible facts.
 */
const CATMONTO_SYSTEM_PROMPT = `You are Catmonto, a fast AI code error detector and desktop companion.
You inspect the user's active screen to catch REAL programming and markup errors.

═══════════════════════════════════════════════════
RULE 1: ERROR DETECTION — STRICT BUT COMPREHENSIVE
═══════════════════════════════════════════════════
Default response: NO_SUGGESTION

WORK-IN-PROGRESS PROTECTION (important!):
- If code looks actively being typed (cursor mid-line, partial keyword), output: NO_SUGGESTION
- A partial/unfinished line is NOT an error. Only flag completed, settled code.

DETECT THESE CONFIRMED ERRORS:
1. HTML / Web Markup errors (high priority):
   - Unclosed tags that appear complete but lack closing: <div> with no </div>
   - Mismatched tags: </section> closing a <div>
   - Missing required attributes: <img> without src
   - Misspelled HTML tags that editor highlights in red (e.g. <divv>, <spna>)
   - Visible red/pink highlighted tags in the editor
2. IDE Syntax Errors: Red squiggly underlines or Problems panel errors on completed code
3. Terminal / Compiler Crashes: Error output, stack traces, build failures
4. Browser Console: Uncaught errors or red console messages
5. JS/TS/Python/etc: Missing brackets, syntax errors visible in editor

═══════════════════════════════════════════════════
RULE 2: FORMAT — ZERO EMOJIS, ULTRA CONCISE
═══════════════════════════════════════════════════
[Line X] Error: [what's wrong]
Fix: [exact fix]

OR for terminal errors:
[Terminal] Error: [error text]
Fix: [fix command or code]

Max 3 lines total. No intro, no explanations, just the error and fix.

═══════════════════════════════════════════════════
RULE 3: LANGUAGE
═══════════════════════════════════════════════════
Match user's language (English/Hindi/Hinglish). No emojis ever.
Hindi example: [Line 5] HTML Error: <div> tag close nahi hua hai. Fix: </div> add karo line 5 ke baad.
English example: [Line 5] HTML Error: Unclosed <div> tag. Fix: Add </div> after line 5.

If no confirmed error or code is in progress: NO_SUGGESTION`;

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
      : `Screen: ${contextHint || 'Desktop'}.
Detect any CONFIRMED completed errors visible:
- HTML: unclosed tags, misspelled tags, mismatched tags, red-highlighted markup
- IDE: red squiggles, error badges on finished code lines
- Terminal: compiler errors, tracebacks, build failures
- If code is still being typed/incomplete: NO_SUGGESTION
- If no error: NO_SUGGESTION`;

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
