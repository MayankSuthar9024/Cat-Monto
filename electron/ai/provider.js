/**
 * Base abstract class for AI Vision providers.
 * Catmonto is decoupled from specific providers so alternate local/offline models
 * can be plugged in seamlessly in the future.
 */
class AIProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Check if the provider service is reachable and running.
   * @returns {Promise<{ available: boolean, error?: string, model?: string }>}
   */
  async checkHealth() {
    throw new Error('checkHealth() must be implemented by subclass');
  }

  /**
   * Analyze screen image + optional user prompt.
   * @param {Object} options
   * @param {string} options.imageBase64 - Base64 encoded screenshot (PNG or JPEG)
   * @param {string} [options.userPrompt] - Optional manual question from user
   * @param {string} [options.contextHint] - Optional foreground window hint or app title
   * @returns {Promise<{ suggestion: string | null, confidence?: number, language?: string, raw?: string }>}
   */
  async analyzeScreen({ imageBase64, userPrompt, contextHint }) {
    throw new Error('analyzeScreen() must be implemented by subclass');
  }
}

module.exports = { AIProvider };
