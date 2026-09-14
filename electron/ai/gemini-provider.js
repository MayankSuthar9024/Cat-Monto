const { AIProvider } = require('./provider');

const GEMINI_SYSTEM_PROMPT = `You are Catmonto, a fast AI code error detector and desktop companion.
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

const GEMINI_MANUAL_ASK_PROMPT = `You are Catmonto, a professional AI programming assistant.
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

class GeminiProvider extends AIProvider {
  constructor(options = {}) {
    super('gemini');
    this.apiKey = options.apiKey || '';
    const deprecated = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    const initial = options.model || 'gemini-3.5-flash';
    this.model = deprecated.includes(initial) ? 'gemini-3.5-flash' : initial;
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
  }

  setModel(model) {
    const deprecated = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    const chosen = model || 'gemini-3.5-flash';
    this.model = deprecated.includes(chosen) ? 'gemini-3.5-flash' : chosen;
  }

  /**
   * Fast verification of Gemini API Key validity without generating heavy tokens.
   */
  async checkHealth(testKey = null) {
    const keyToTest = (testKey !== null ? testKey : this.apiKey || '').trim();
    if (!keyToTest) {
      return { available: false, error: 'No Gemini API key configured.' };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(keyToTest)}`;
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.error?.message || `Google API returned status ${response.status}`;
        return { available: false, error: msg };
      }

      const data = await response.json();
      const models = (data.models || []).map((m) => m.name.replace('models/', ''));
      return {
        available: true,
        models,
        activeModel: this.model,
      };
    } catch (err) {
      return {
        available: false,
        error: `Network error reaching Google Gemini: ${err.message}`,
      };
    }
  }

  /**
   * Multimodal vision analysis — optimized for speed and HTML error detection.
   * Uses primary model only with tight token limit; falls back once on failure.
   */
  async analyzeScreen({ imageBase64, userPrompt, contextHint }) {
    if (!this.apiKey) {
      throw new Error('Gemini API key is not configured. Please add it in settings.');
    }

    const isManualAsk = Boolean(userPrompt && userPrompt.trim().length > 0);
    const systemPrompt = isManualAsk ? GEMINI_MANUAL_ASK_PROMPT : GEMINI_SYSTEM_PROMPT;

    // Remove data URL scheme prefix if present
    const cleanBase64 = (imageBase64 || '').replace(/^data:image\/[a-z]+;base64,/, '');

    const promptText = isManualAsk
      ? `User Question: "${userPrompt}"\nContext: ${contextHint || 'Desktop Workspace'}\nAnswer directly with exact line numbers and solutions. No emojis.`
      : `Screen: ${contextHint || 'Desktop'}.
Detect any CONFIRMED completed errors visible:
- HTML: unclosed tags, misspelled tags, mismatched tags, red-highlighted markup
- IDE: red squiggles, error badges on finished code lines
- Terminal: compiler errors, tracebacks, build failures
- If code is still being typed/incomplete: NO_SUGGESTION
- If no error: NO_SUGGESTION`;

    const userParts = [{ text: promptText }];
    if (cleanBase64 && cleanBase64.length > 50) {
      userParts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    // Use only primary model + one fast fallback to avoid long waits from 3-model chain
    const primaryModel = this.model || 'gemini-flash-lite-latest';
    const fallbackModel = primaryModel === 'gemini-flash-lite-latest' ? 'gemini-3.5-flash' : 'gemini-flash-lite-latest';
    const modelsToTry = [...new Set([primaryModel, fallbackModel])];

    let lastError = null;

    for (const modelToUse of modelsToTry) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${encodeURIComponent(this.apiKey.trim())}`;

      const generationConfig = {
        temperature: isManualAsk ? 0.2 : 0.0,
        // 256 tokens is more than enough for a 3-line error report — much faster than 1024
        maxOutputTokens: isManualAsk ? 512 : 256,
      };

      // Only models supporting thinking accept thinkingConfig (e.g. 3.5, 2.5-pro)
      if (modelToUse.includes('3.5') || modelToUse.includes('pro')) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }

      const payload = {
        contents: [
          {
            role: 'user',
            parts: userParts,
          },
        ],
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig,
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          // 12s timeout: fast enough to feel responsive, long enough for the model to respond
          signal: AbortSignal.timeout(12000),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
          if (response.status === 400 || response.status === 429 || response.status === 503 || response.status === 404) {
            console.warn(`[GeminiProvider] Model ${modelToUse} returned ${response.status}. Trying fallback...`);
            lastError = new Error(errMsg);
            continue;
          }
          throw new Error(errMsg);
        }

        const data = await response.json();
        const rawText = (data?.candidates?.[0]?.content?.parts || [])
          .map((p) => p.text)
          .join(' ')
          .trim();

        if (!isManualAsk && (!rawText || rawText.toUpperCase().includes('NO_SUGGESTION'))) {
          return { suggestion: null, raw: rawText, activeModel: modelToUse };
        }

        return {
          suggestion: rawText,
          raw: rawText,
          activeModel: modelToUse,
        };
      } catch (err) {
        lastError = err;
        if (!err.message?.includes('429') && !err.message?.includes('503') && !err.message?.includes('404')) {
          break;
        }
      }
    }

    console.error('[GeminiProvider] All models failed. Last error:', lastError?.message);
    throw lastError || new Error('All Gemini models failed.');
  }
}

module.exports = { GeminiProvider, GEMINI_SYSTEM_PROMPT };
