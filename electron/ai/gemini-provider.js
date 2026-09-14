const { AIProvider } = require('./provider');

const GEMINI_SYSTEM_PROMPT = `You are Catmonto, a professional AI programming assistant and desktop companion.
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
    this.model = options.model || 'gemini-3.5-flash';
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
  }

  setModel(model) {
    this.model = model || 'gemini-3.5-flash';
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
   * Multimodal vision analysis with automatic fallback for high reliability
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
      ? `User Question about visible screen: "${userPrompt}"\nContext: ${contextHint || 'Desktop Workspace'}\nAnalyze the visible screen and answer directly with exact line numbers and solutions without emojis.`
      : `Active Workspace Inspection: ${contextHint || 'Desktop'}.
Task: Inspect the screen for any active code or markup errors in any language (HTML, CSS, JS/TS, Python, C++, Java, etc.).
- If NO error exists on screen, output ONLY: NO_SUGGESTION
- If a REAL error is visible (e.g. unclosed/mismatched HTML tag, IDE red squiggly error, terminal compiler error, or console crash), specify line number, error description, and fix using standard format without emojis.`;

    const userParts = [{ text: promptText }];
    if (cleanBase64 && cleanBase64.length > 50) {
      userParts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    // Candidate models in order of priority (Fastest & most accurate first)
    const primaryModel = this.model || 'gemini-flash-lite-latest';
    const fallbackChain = [primaryModel, 'gemini-flash-lite-latest', 'gemini-3.5-flash'];
    const uniqueModels = [...new Set(fallbackChain)];

    let lastError = null;

    for (const modelToUse of uniqueModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${encodeURIComponent(this.apiKey.trim())}`;

      const generationConfig = {
        temperature: isManualAsk ? 0.2 : 0.0,
        maxOutputTokens: 1024,
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
          signal: AbortSignal.timeout(22000),
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => ({}));
          const errMsg = errJson?.error?.message || `HTTP ${response.status}`;
          if (response.status === 400 || response.status === 429 || response.status === 503 || response.status === 404) {
            console.warn(`[GeminiProvider] Model ${modelToUse} returned ${response.status} (${errMsg}). Trying fallback model...`);
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
