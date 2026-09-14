import React, { useState, useEffect } from 'react';

/**
 * Remove all emojis to maintain a clean, professional developer interface
 */
function stripEmojis(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
    .trim();
}

/**
 * Parses structured AI suggestions into clean segments:
 * - Line / Location badge
 * - Error description
 * - Fix / Solution snippet
 */
function parseSuggestion(rawText) {
  const clean = stripEmojis(rawText);

  let locationBadge = null;
  let errorText = clean;
  let fixText = null;

  // Check for [Line 102] or [Terminal] or [System]
  const badgeMatch = clean.match(/^\[(Line\s*\d+|Terminal|System|Error)\]/i);
  if (badgeMatch) {
    locationBadge = badgeMatch[1];
    errorText = clean.substring(badgeMatch[0].length).trim();
  } else {
    // Check for "Line 102:" format
    const lineMatch = clean.match(/^Line\s*(\d+)[\s:]+/i);
    if (lineMatch) {
      locationBadge = `Line ${lineMatch[1]}`;
      errorText = clean.substring(lineMatch[0].length).trim();
    }
  }

  // Check for "Fix:" or "Solution:" divider
  const fixSplit = errorText.split(/\n(?:\s*(?:Fix|Solution):\s*)/i);
  if (fixSplit.length > 1) {
    errorText = fixSplit[0].replace(/^(?:Error:\s*)/i, '').trim();
    fixText = fixSplit.slice(1).join('\n').trim();
  } else {
    const inlineFixMatch = errorText.match(/^(.*?)(?:\s+(?:Fix|Solution):\s+)(.*)$/is);
    if (inlineFixMatch) {
      errorText = inlineFixMatch[1].replace(/^(?:Error:\s*)/i, '').trim();
      fixText = inlineFixMatch[2].trim();
    }
  }

  return { locationBadge, errorText, fixText, clean };
}

/**
 * Render text with inline markdown code tags `code`
 */
function renderFormattedText(text) {
  if (!text) return null;
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code key={i} className="bubble-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Professional SpeechBubble component with beautiful typography and zero emojis
 */
export default function SpeechBubble({
  text,
  onDismiss,
  autoDismissMs = 15000,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!text || autoDismissMs <= 0) return;
    const timer = setTimeout(() => {
      if (onDismiss) onDismiss();
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [text, autoDismissMs, onDismiss]);

  if (!text) return null;

  const { locationBadge, errorText, fixText, clean } = parseSuggestion(text);

  const handleCopyFix = async (e) => {
    e.stopPropagation();
    const textToCopy = fixText || clean;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  return (
    <div className="bubble-card no-drag">
      {/* Sleek Header */}
      <div className="bubble-header">
        <div className="bubble-meta-left">
          <span className="bubble-brand">Catmonto</span>
          {locationBadge && (
            <span className="bubble-badge-pill">
              {locationBadge}
            </span>
          )}
        </div>

        <div className="bubble-actions">
          {fixText && (
            <button
              type="button"
              onClick={handleCopyFix}
              className="bubble-copy-btn"
              title="Copy fix"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDismiss}
            className="bubble-close-btn"
            title="Dismiss notification"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Structured Content */}
      <div className="bubble-content">
        {fixText ? (
          <>
            <div className="bubble-error-desc">
              {renderFormattedText(errorText)}
            </div>
            <div className="bubble-fix-container">
              <div className="bubble-fix-label">Fix:</div>
              <div className="bubble-fix-code">
                {renderFormattedText(fixText)}
              </div>
            </div>
          </>
        ) : (
          <div className="bubble-plain-text">
            {renderFormattedText(clean)}
          </div>
        )}
      </div>

      <div className="bubble-arrow" />
    </div>
  );
}
