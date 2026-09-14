import React, { useState, useEffect } from 'react';
import CatCharacter from './components/Cat/CatCharacter';
import SpeechBubble from './components/SpeechBubble/SpeechBubble';
import AskCatInput from './components/AskCat/AskCatInput';
import ControlBar from './components/Controls/ControlBar';
import SettingsModal from './components/Settings/SettingsModal';

export default function App() {
  const [catState, setCatState] = useState('idle'); // 'idle' | 'thinking' | 'speaking' | 'attention' | 'sleeping'
  const [suggestion, setSuggestion] = useState(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [showAskInput, setShowAskInput] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({});
  const [ollamaStatus, setOllamaStatus] = useState({ available: false });

  // Load initial settings and status from Electron preload bridge
  useEffect(() => {
    if (window.catmonto) {
      window.catmonto.getSettings().then((s) => {
        setSettings(s || {});
        setIsMonitoring(Boolean(s?.monitoringEnabled));
      });

      window.catmonto.checkOllama().then((status) => {
        setOllamaStatus(status);
      });

      // Listen for suggestions from background screen analysis
      const unsubscribeSuggestion = window.catmonto.onSuggestion((data) => {
        if (data?.text) {
          setSuggestion(data.text);
          setCatState('speaking');
        }
      });

      // Listen for cat state changes
      const unsubscribeState = window.catmonto.onStateChange((state) => {
        setCatState(state);
      });

      return () => {
        unsubscribeSuggestion();
        unsubscribeState();
      };
    } else {
      // Browser preview fallback
      setSuggestion("Hi, I'm Catmonto! Enable screen understanding to let me observe your workflow.");
    }
  }, []);

  const handleToggleMonitoring = async () => {
    const nextState = !isMonitoring;
    setIsMonitoring(nextState);
    if (window.catmonto) {
      await window.catmonto.toggleMonitoring(nextState);
    }
    if (nextState) {
      setSuggestion("Screen understanding enabled. Main chup rahunga jab tak koi madad na chahiye ho!");
      setCatState('attention');
      setTimeout(() => setCatState('idle'), 2500);
    } else {
      setSuggestion("Observation paused. Screen analysis band hai.");
      setCatState('idle');
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
      // Mock browser reply in Hinglish/English
      setTimeout(() => {
        setIsAsking(false);
        setSuggestion(`Sahi sawaal pucha: "${query}". Sab theek lag raha hai!`);
        setCatState('speaking');
      }, 1000);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
    if (window.catmonto) {
      await window.catmonto.updateSettings(newSettings);
      const status = await window.catmonto.checkOllama();
      setOllamaStatus(status);
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

  return (
    <div className="app-container">
      {/* Draggable handle bar at top */}
      <div className="drag-handle-bar drag-region">
        <div className="drag-pill" />
      </div>

      {/* Speech Bubble / Suggestions */}
      {suggestion && (
        <SpeechBubble
          text={suggestion}
          onDismiss={() => {
            setSuggestion(null);
            if (catState === 'speaking') setCatState('idle');
          }}
        />
      )}

      {/* Ask Cat manual input */}
      {showAskInput && (
        <AskCatInput
          isLoading={isAsking}
          onAsk={handleAskCat}
          onClose={() => setShowAskInput(false)}
        />
      )}

      {/* Main Cat Character */}
      <div className="drag-region">
        <CatCharacter
          state={catState}
          onCatClick={() => {
            setShowAskInput((prev) => !prev);
          }}
        />
      </div>

      {/* Bottom control pill */}
      <ControlBar
        isMonitoring={isMonitoring}
        onToggleMonitoring={handleToggleMonitoring}
        onToggleAsk={() => setShowAskInput((prev) => !prev)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isOllamaOnline={ollamaStatus.available}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onCheckOllama={handleCheckOllama}
        ollamaStatus={ollamaStatus}
      />
    </div>
  );
}
