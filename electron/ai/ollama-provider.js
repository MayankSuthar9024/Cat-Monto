const { AIProvider } = require('./provider');

/**
 * System prompt following Catmonto product philosophy:
 * - Observe -> Understand -> Decide -> Suggest
 * - Do NOT talk constantly. Return NO_SUGGESTION when not strictly actionable/valuable.
 * - Concise (1-3 sentences).
 * - Match user language automatically (English, Hindi, Hinglish).
 * - Never ask for sensitive data, never invent non-visible facts.
 */
const CATMONTO_SYSTEM_PROMPT = `You are Catmonto, a friendly, intelligent desktop AI companion represented by a cute cat on the user's screen.
You can see the user's active screen context.

CRITICAL INSTRUCTIONS:
1. Your goal is NOT to constantly talk. You must be quiet most of the time.
2. If there is nothing genuinely useful, critical, actionable, or worth interrupting the user, respond with EXACTLY:
NO_SUGGESTION
3. If an obvious error (syntax error, terminal traceback, broken layout, 404, missing import) or a high-value suggestion is visible, give a short, helpful hint.
4. Keep suggestions very short: 1 to 2 concise sentences maximum.
5. MULTILINGUAL MATCHING:
   - If the code, comments, terminal, or user context is in Hinglish (Hindi written in Roman letters) or the user asks in Hinglish -> respond naturally in friendly Hinglish!
     Example: "Bhai, yaha syntax error lag raha hai. Line 24 check kar."
   - If Hindi -> respond in Hindi.
   - If English -> respond in clear, friendly, casual English.
   - Do NOT mix languages artificially. Match the tone and language naturally.
6. When responding, output ONLY the suggestion text (or NO_SUGGESTION). Do NOT output reasoning, markdown wrappers, or metadata.`;

const MANUAL_ASK_PROMPT = `You are Catmonto, a friendly desktop AI cat. The user is asking you a direct question about their screen.
Look at the attached screen image and answer the user's question directly and concisely in 1 to 3 friendly sentences.
Match the user's language (English, Hindi, or Hinglish) naturally.`;

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
      ? `User question: "${userPrompt}"\n${contextHint ? `Context: ${contextHint}` : ''}`
      : `Observe this screen. Context: ${contextHint || 'Desktop'}. Remember: if nothing is critical or actionable, return NO_SUGGESTION.`;

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
            temperature: isManualAsk ? 0.4 : 0.2,
            top_p: 0.9,
            num_predict: 120, // keep it short!
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
      if (!rawText || rawText.toUpperCase().includes('NO_SUGGESTION')) {
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
