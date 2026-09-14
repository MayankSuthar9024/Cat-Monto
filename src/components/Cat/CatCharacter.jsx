import React, { useState, useEffect, useRef } from 'react';
import catSleeping from '../../assets/cat-sleeping.png';
import catAwake from '../../assets/cat-awake.png';

/**
 * Pixel-art Cat Character for Catmonto
 *
 * States:
 * - 'sleeping': Eyes closed, peaceful breathing animation, floating Zzz (Default when no code errors)
 * - 'attention' / 'error': Wide alert yellow eyes, wake-up pop animation, alert badge (When error in code)
 * - 'speaking': Wide eyes with subtle friendly speaking bounce (Explaining suggestion/fix)
 * - 'thinking': Wide eyes with subtle thinking sparkle (Analyzing screen)
 * - 'idle': Wide eyes, awake & attentive
 */
export default function CatCharacter({
  state = 'sleeping',
  hasError = false,
  onCatClick,
}) {
  const containerRef = useRef(null);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const prevStateRef = useRef(state);

  const isSleeping = state === 'sleeping';

  // Trigger wake-up bounce animation when waking up from sleep
  useEffect(() => {
    if (prevStateRef.current === 'sleeping' && state !== 'sleeping') {
      setIsWakingUp(true);
      const timer = setTimeout(() => setIsWakingUp(false), 800);
      return () => clearTimeout(timer);
    }
    prevStateRef.current = state;
  }, [state]);

  // Determine dynamic animation classes
  let animationClass = '';
  if (isSleeping) {
    animationClass = 'cat-sleep-breathe';
  } else if (isWakingUp) {
    animationClass = 'cat-wake-bounce';
  } else if (state === 'speaking') {
    animationClass = 'cat-speaking-bob';
  } else if (state === 'thinking') {
    animationClass = 'cat-thinking-pulse';
  } else {
    animationClass = 'cat-alert-float';
  }

  const isAlertOrError = hasError || state === 'attention' || state === 'error';

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        e.stopPropagation();
        if (onCatClick) onCatClick(e);
      }}
      className={`cat-character-wrapper no-drag ${animationClass}`}
      style={{ width: 144, height: 148, cursor: 'pointer' }}
      title={
        isSleeping
          ? 'Cat is sleeping (Code is error-free) — Click to open Settings'
          : 'Cat is awake (Checking your screen) — Click to open Settings'
      }
    >
      {/* Ground soft shadow */}
      <div className={`cat-ground-shadow ${isSleeping ? 'shadow-sleeping' : 'shadow-awake'}`} />

      {/* Pixel Art Cat Images (Dual-layered for zero flicker transition) */}
      <div className="cat-pixel-viewport">
        <img
          src={catSleeping}
          alt="Cat Sleeping peacefully (No code errors)"
          className={`cat-pixel-img ${isSleeping ? 'is-active' : 'is-hidden'}`}
          draggable={false}
        />
        <img
          src={catAwake}
          alt="Cat Awake (Alert to code status)"
          className={`cat-pixel-img ${!isSleeping ? 'is-active' : 'is-hidden'}`}
          draggable={false}
        />
      </div>

      {/* Floating Zzz particles when sleeping */}
      {isSleeping && (
        <div className="cat-floating-zzz no-drag">
          <span className="zzz z1">z</span>
          <span className="zzz z2">z</span>
          <span className="zzz z3">Z</span>
        </div>
      )}

      {/* Alert exclamation badge when an error or alert state is active */}
      {isAlertOrError && (
        <div className="cat-alert-badge" title="Code issue detected!">
          <span>!</span>
        </div>
      )}

      {/* Thinking sparkle dots */}
      {state === 'thinking' && (
        <div className="cat-thinking-badge">
          <span className="dot dot-1" />
          <span className="dot dot-2" />
          <span className="dot dot-3" />
        </div>
      )}
    </div>
  );
}
