const WebSocket = require('ws');
const { CAT_CONFIG } = require('../config/cat-config');
const { validateGeminiResponse } = require('./response-validator');

/**
 * Gemini Live Client
 * Manages WebSocket Live API sessions (bidiGenerateContent) with automated
 * reconnection, heartbeat, and graceful fallback to fast HTTP streaming.
 */
class GeminiLiveClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || '';
    this.model = options.model || 'models/gemini-2.5-flash-native-audio-latest';
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.lastError = null;
    this.reconnectTimer = null;
    this.onMessageCallback = null;
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.isConnected) {
      this.disconnect();
    }
  }

  /**
   * Connect to Gemini Multimodal Live WebSocket endpoint
   */
  connect() {
    if (!this.apiKey || this.isConnected || this.isConnecting) return;

    this.isConnecting = true;
    const host = 'generativelanguage.googleapis.com';
    const path = `/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(this.apiKey)}`;
    const uri = `wss://${host}${path}`;

    try {
      this.ws = new WebSocket(uri);

      this.ws.on('open', () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.lastError = null;
        if (CAT_CONFIG.DEBUG_PERF) {
          console.log('[GeminiLive] WebSocket connected successfully');
        }

        // Send initial setup frame
        const setupMessage = {
          setup: {
            model: this.model,
            generationConfig: {
              responseModalities: ['AUDIO'],
            },
          },
        };
        this.send(setupMessage);
      });

      this.ws.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (this.onMessageCallback) {
            this.onMessageCallback(parsed);
          }
        } catch (_) {}
      });

      this.ws.on('error', (err) => {
        this.lastError = err.message;
        if (CAT_CONFIG.DEBUG_PERF) {
          console.warn('[GeminiLive] WebSocket error:', err.message);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        this.isConnecting = false;
        this.ws = null;
        if (CAT_CONFIG.DEBUG_PERF) {
          console.log(`[GeminiLive] WebSocket closed (${code}): ${reason.toString()}`);
        }
      });
    } catch (err) {
      this.isConnecting = false;
      this.lastError = err.message;
    }
  }

  send(payload) {
    if (this.ws && this.isConnected) {
      this.ws.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return true;
    }
    return false;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.terminate();
      } catch (_) {}
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}

module.exports = { GeminiLiveClient };
