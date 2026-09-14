import React, { useState } from 'react';

/**
 * SettingsModal component with pure Vanilla CSS and SVG
 */
export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onCheckOllama,
  ollamaStatus,
}) {
  if (!isOpen) return null;

  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl || 'http://127.0.0.1:11434');
  const [model, setModel] = useState(settings.model || 'qwen2.5-vl:latest');
  const [excludedApps, setExcludedApps] = useState(
    (settings.excludedApps || []).join(', ')
  );
  const [simulationMode, setSimulationMode] = useState(settings.simulationMode || false);
  const [checking, setChecking] = useState(false);

  const handleSave = () => {
    const parsedExclusions = excludedApps
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onSaveSettings({
      ollamaUrl,
      model,
      excludedApps: parsedExclusions,
      simulationMode,
    });
    onClose();
  };

  const handleCheck = async () => {
    setChecking(true);
    await onCheckOllama();
    setChecking(false);
  };

  return (
    <div className="modal-overlay no-drag">
      <div className="modal-dialog">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--primary)' }}>
              <rect width="16" height="16" x="4" y="4" rx="2"/>
              <rect width="6" height="6" x="9" y="9" rx="1"/>
              <path d="M15 2v2M9 2v2M20 15h2M20 9h2M9 20v2M15 20v2M2 9h2M2 15h2"/>
            </svg>
            <span>Catmonto Settings</span>
          </div>
          <button onClick={onClose} className="bubble-close-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Ollama Connection Section */}
        <div className="form-group">
          <label className="form-label">Local Ollama URL</label>
          <div className="test-row">
            <input
              type="text"
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              className="form-input"
              placeholder="http://127.0.0.1:11434"
            />
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="test-btn"
              title="Test Connection"
            >
              {checking ? (
                <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 16h5v5"/>
                </svg>
              )}
              <span>Test</span>
            </button>
          </div>
          <div style={{ marginTop: 4, fontSize: 11 }}>
            {ollamaStatus?.available ? (
              <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Ollama connected ({ollamaStatus.models?.length || 0} models found)
              </span>
            ) : (
              <span style={{ color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Ollama offline. Run: <code style={{ background: '#fef3c7', padding: '1px 3px', borderRadius: 3 }}>ollama run qwen2.5-vl</code>
              </span>
            )}
          </div>
        </div>

        {/* Model */}
        <div className="form-group">
          <label className="form-label">Vision Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="form-input"
            placeholder="qwen2.5-vl:latest or llava"
          />
        </div>

        {/* Privacy Exclusions */}
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Privacy Exclusions (Keywords)
          </label>
          <textarea
            value={excludedApps}
            onChange={(e) => setExcludedApps(e.target.value)}
            rows={2}
            className="form-input"
            style={{ fontFamily: 'monospace', fontSize: 11, resize: 'none' }}
            placeholder="banking, bitwarden, 1password, private"
          />
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
            Monitoring pauses when these match foreground window titles.
          </div>
        </div>

        {/* Simulation Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>Demo / Simulation Mode</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Generates demo tips without Ollama</div>
          </div>
          <input
            type="checkbox"
            checked={simulationMode}
            onChange={(e) => setSimulationMode(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ padding: '5px 12px', background: 'transparent', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#64748b' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{ padding: '5px 14px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}
