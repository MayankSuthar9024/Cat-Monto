import React, { useState, useEffect } from 'react';
import CatCharacter from './components/Cat/CatCharacter';
import SpeechBubble from './components/SpeechBubble/SpeechBubble';
import AskCatInput from './components/AskCat/AskCatInput';
import SetupWizardModal from './components/Wizard/SetupWizardModal';

export default function App() {
  const [catState, setCatState] = useState('sleeping'); // 'sleeping' (no errors) | 'attention' | 'speaking' | 'thinking' | 'idle'
  const [suggestion, setSuggestion] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showAskInput, setShowAskInput] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [ollamaStatus, setOllamaStatus] = useState({ available: false });

  // Load initial settings and status from Electron preload bridge
  useEffect(() => {
    if (window.catmonto) {
      window.catmonto
        .getSettings()
        .then((s) => {
          setSettings(s || {});
          setIsMonitoring(Boolean(s?.monitoringEnabled));
        })
        .catch((err) => console.warn('[App] getSettings error:', err));

      window.catmonto
        .checkOllama()
        .then((status) => {
          setOllamaStatus(status);
        })
        .catch((err) => console.warn('[App] checkOllama error:', err));

      // Listen for suggestions from background screen analysis (errors in code)
      const unsubscribeSuggestion = window.catmonto.onSuggestion((data) => {
        if (data?.text) {
          setSuggestion(data.text);
          setCatState('speaking');
        }
      });

      // Listen for cat state changes
      const unsubscribeState = window.catmonto.onStateChange((state) => {
        setCatState(state || 'sleeping');
      });

      return () => {
        unsubscribeSuggestion();
        unsubscribeState();
      };
    }
  }, []);

  const openWizard = () => {
    setIsWizardOpen(true);
    if (window.catmonto?.setWindowSize) {
      window.catmonto.setWindowSize(780, 560, false);
    }
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    if (window.catmonto?.setWindowSize) {
      window.catmonto.setWindowSize(340, 420, false);
    }
  };

  const handleToggleMonitoring = async () => {
    const nextState = !isMonitoring;
    setIsMonitoring(nextState);
    if (window.catmonto) {
      await window.catmonto.toggleMonitoring(nextState);
    }
    if (nextState) {
      setSuggestion("Observation enabled! I'll sleep quietly and wake up whenever an error appears in your code.");
      setCatState('attention');
      setTimeout(() => {
        setCatState('sleeping');
        setSuggestion(null);
      }, 3500);
    } else {
      setSuggestion(null);
      setCatState('sleeping');
    }
  };

  const handleAskCat = async (query) => {
    setIsAsking(true);
    setCatState('thinking');
    if (window.catmonto) {
      const res = await window.catmonto.askCat(query);
      setIsAsking(false);
      if (res.success && res.text) {
        setSuggestion(res.text);
        setCatState('speaking');
      } else if (res.error) {
        setSuggestion(`Oops: ${res.error}`);
        setCatState('speaking');
      }
    } else {
      // Mock browser reply
      setTimeout(() => {
        setIsAsking(false);
        setSuggestion(`I checked your screen: no errors found! Going back to sleep 💤`);
        setCatState('speaking');
        setTimeout(() => setCatState('sleeping'), 3500);
      }, 1000);
    }
  };

  // Quick toggle to simulate a code error and test cat wake-up
  const handleToggleTestError = () => {
    if (catState === 'sleeping' && !suggestion) {
      setSuggestion("⚠️ SyntaxError: Unexpected token '}' in code. Check closing brackets!");
      setCatState('speaking');
    } else {
      setSuggestion(null);
      setCatState('sleeping');
    }
  };

  const handleSaveSettings = async (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    if (window.catmonto) {
      await window.catmonto.updateSettings(newSettings);
      if (newSettings.monitoringEnabled !== undefined) {
        setIsMonitoring(Boolean(newSettings.monitoringEnabled));
      }
      if (newSettings.aiProvider === 'ollama') {
        const status = await window.catmonto.checkOllama();
        setOllamaStatus(status);
      }
    }
  };

  const handleCheckOllama = async () => {
    if (window.catmonto) {
      const status = await window.catmonto.checkOllama();
      setOllamaStatus(status);
      return status;
    }
    return { available: false };
  };

  const hasActiveError = Boolean(suggestion) || catState === 'attention' || catState === 'speaking';

  return (
    <div className={`app-container ${isWizardOpen ? 'wizard-active' : ''}`}>
      {/* Draggable handle bar at top (compact cat mode) */}
      {!isWizardOpen && (
        <div className="drag-handle-bar drag-region" title="Drag to move Catmonto">
          <div className="drag-pill" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.catmonto?.minimize();
            }}
            className="cat-min-btn no-drag"
            title="Minimize Cat to taskbar"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {/* Speech Bubble / Suggestions */}
      {!isWizardOpen && suggestion && (
        <SpeechBubble
          text={suggestion}
          onDismiss={() => {
            setSuggestion(null);
            setCatState('sleeping');
          }}
        />
      )}

      {/* Ask Cat manual input */}
      {!isWizardOpen && showAskInput && (
        <AskCatInput
          isLoading={isAsking}
          onAsk={handleAskCat}
          onClose={() => setShowAskInput(false)}
        />
      )}

      {/* Main Cat Character (Click to open Setup Wizard, Right-click to Ask) */}
      {!isWizardOpen && (
        <div
          className="cat-wrapper no-drag"
          onContextMenu={(e) => {
            e.preventDefault();
            setShowAskInput((prev) => !prev);
          }}
          title={
            catState === 'sleeping'
              ? 'No errors in code — Cat is sleeping peacefully. Click to open Settings.'
              : 'Error detected! Cat is awake. Click to open Settings.'
          }
        >
          <CatCharacter
            state={catState}
            hasError={hasActiveError}
            onCatClick={openWizard}
          />

          {/* Floating Quick Action badge */}
          <div className="cat-quick-actions no-drag">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowAskInput((prev) => !prev);
              }}
              className="quick-ask-btn"
              title="Ask Cat about your screen"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Ask</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTestError();
              }}
              className={`quick-status-btn ${hasActiveError ? 'error-active' : 'sleep-mode'}`}
              title={
                hasActiveError
                  ? 'Error active (Click to clear and let cat sleep)'
                  : 'Test Code Error: Click to simulate an error and wake the cat up'
              }
            >
              <span className={`status-dot-mini ${hasActiveError ? 'error-dot pulse' : 'sleep-dot'}`} />
              <span>{hasActiveError ? 'Error!' : 'Sleeping'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleMonitoring();
              }}
              className={`quick-status-btn ${isMonitoring ? 'active' : 'idle'}`}
              title={isMonitoring ? 'Monitoring Active (Click to Pause)' : 'Monitoring Paused (Click to Resume)'}
            >
              <span className={`status-dot-mini ${isMonitoring ? 'pulse' : ''}`} />
              <span>{isMonitoring ? 'Watch' : 'Off'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Multi-step Setup & Settings Wizard matching reference UI */}
      {isWizardOpen && (
        <SetupWizardModal
          isOpen={isWizardOpen}
          onClose={closeWizard}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          onCheckOllama={handleCheckOllama}
          ollamaStatus={ollamaStatus}
        />
      )}
    </div>
  );
}
