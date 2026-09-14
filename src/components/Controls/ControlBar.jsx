import React from 'react';

/**
 * ControlBar component using pure Vanilla CSS and SVG
 */
export default function ControlBar({
  isMonitoring,
  onToggleMonitoring,
  onToggleAsk,
  onOpenSettings,
  isOllamaOnline,
  aiProvider = 'gemini',
}) {
  const isGemini = aiProvider === 'gemini';
  const statusTooltip = isGemini
    ? (isOllamaOnline ? 'Google Gemini API connected & ready' : 'Gemini API key not configured (Click Settings to configure)')
    : (isOllamaOnline ? 'Local Ollama Vision Model connected' : 'Ollama not detected (Check Ollama in Settings)');
  return (
    <div className="control-bar no-drag">
      {/* Monitoring toggle */}
      <button
        onClick={onToggleMonitoring}
        className={`monitor-btn ${isMonitoring ? 'active' : 'paused'}`}
        title={isMonitoring ? 'Monitoring Active (Click to Pause)' : 'Monitoring Paused (Click to Enable)'}
      >
        {isMonitoring ? (
          <>
            <span className="status-dot pulse" />
            <span>Observing</span>
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
              <line x1="2" x2="22" y1="2" y2="22"/>
            </svg>
            <span>Paused</span>
          </>
        )}
      </button>

      {/* Ask Cat toggle */}
      <button
        onClick={onToggleAsk}
        className="icon-btn"
        title="Ask Cat about screen"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {/* Status dot for active AI provider */}
      <div
        className="status-dot"
        style={{
          backgroundColor: isOllamaOnline ? 'var(--success)' : 'var(--warning)',
          cursor: 'help',
        }}
        title={statusTooltip}
      />

      {/* Settings */}
      <button
        onClick={onOpenSettings}
        className="icon-btn"
        title="Preferences & Privacy"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
    </div>
  );
}
