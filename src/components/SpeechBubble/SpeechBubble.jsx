import React, { useEffect } from 'react';

/**
 * SpeechBubble component using pure semantic Vanilla CSS
 */
export default function SpeechBubble({
  text,
  onDismiss,
  autoDismissMs = 12000,
}) {
  useEffect(() => {
    if (!text || autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [text, autoDismissMs, onDismiss]);

  if (!text) return null;

  return (
    <div className="bubble-card no-drag">
      <div className="bubble-header">
        <div className="bubble-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
          </svg>
          <span>Catmonto</span>
        </div>
        <button
          onClick={onDismiss}
          className="bubble-close-btn"
          title="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="bubble-text">
        {text}
      </div>

      <div className="bubble-arrow" />
    </div>
  );
}
