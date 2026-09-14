import React, { useEffect, useState, useRef } from 'react';

/**
 * Layered, animated Cat character.
 * Supports states:
 * - 'idle': gentle breathing, natural blinking, eye tracking
 * - 'thinking': ear twitch, head tilt, pondering
 * - 'speaking': subtle mouth articulation, bouncy expression
 * - 'attention': perked ears, wide eyes, curious
 * - 'sleeping': curled, closed eyes, subtle zzz float
 */
export default function CatCharacter({ state = 'idle', targetRegion = null, onCatClick }) {
  const [blink, setBlink] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Natural blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, Math.random() * 3000 + 3500);

    return () => clearInterval(blinkInterval);
  }, []);

  // Eye movement tracking mouse or specified target
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current || state === 'sleeping') return;
      const rect = containerRef.current.getBoundingClientRect();
      const catCenterX = rect.left + rect.width / 2;
      const catCenterY = rect.top + rect.height / 2;

      const deltaX = e.clientX - catCenterX;
      const deltaY = e.clientY - catCenterY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Max eye pupil shift (4px)
      const maxShift = 4.5;
      const factor = Math.min(distance / 250, 1) * maxShift;
      const angle = Math.atan2(deltaY, deltaX);

      setEyeOffset({
        x: Math.cos(angle) * factor,
        y: Math.sin(angle) * factor,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [state]);

  // Adjust eye offset if targetRegion is explicitly supplied
  useEffect(() => {
    if (targetRegion) {
      setEyeOffset({
        x: targetRegion.x || 0,
        y: targetRegion.y || 0,
      });
    }
  }, [targetRegion]);

  // State class mapping
  let animationClass = 'animate-breathe';
  if (state === 'thinking') animationClass = 'animate-thinking';
  if (state === 'attention') animationClass = 'animate-perk';
  if (state === 'speaking') animationClass = 'animate-breathe';

  return (
    <div
      ref={containerRef}
      onClick={onCatClick}
      className={`relative cursor-pointer select-none transition-transform duration-300 ${animationClass}`}
      style={{ width: 140, height: 140 }}
      title="Catmonto (Drag to reposition, click to interact)"
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.18)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft ground shadow */}
        <ellipse
          cx="100"
          cy="188"
          rx="65"
          ry="10"
          fill="rgba(0, 0, 0, 0.12)"
          className="transition-all duration-300"
        />

        {/* Tail */}
        <path
          d="M 155 155 C 180 145, 190 125, 185 110 C 180 98, 168 105, 165 115 C 162 125, 155 145, 145 155"
          fill="#4A5568"
          className="transition-transform origin-[150px_155px]"
          style={{
            animation: state === 'speaking' || state === 'attention' ? 'pulse 1.5s infinite' : 'none',
          }}
        />

        {/* Back Ears (Outer) */}
        {/* Left Ear */}
        <path
          d="M 50 85 L 35 28 C 45 30, 75 48, 80 62 Z"
          fill="#374151"
          className={state === 'thinking' ? 'animate-pulse' : ''}
        />
        {/* Left Ear Inner Pink */}
        <path d="M 52 75 L 42 38 C 48 40, 68 55, 72 65 Z" fill="#F472B6" opacity="0.75" />

        {/* Right Ear */}
        <path
          d="M 150 85 L 165 28 C 155 30, 125 48, 120 62 Z"
          fill="#374151"
        />
        {/* Right Ear Inner Pink */}
        <path d="M 148 75 L 158 38 C 152 40, 132 55, 128 65 Z" fill="#F472B6" opacity="0.75" />

        {/* Cat Body */}
        <ellipse cx="100" cy="140" rx="58" ry="46" fill="#4B5563" />
        {/* Cat Belly (Soft Cream/White patch) */}
        <ellipse cx="100" cy="146" rx="34" ry="28" fill="#F3F4F6" opacity="0.9" />

        {/* Paws */}
        <ellipse cx="75" cy="176" rx="14" ry="10" fill="#F3F4F6" stroke="#4B5563" strokeWidth="2" />
        <ellipse cx="125" cy="176" rx="14" ry="10" fill="#F3F4F6" stroke="#4B5563" strokeWidth="2" />

        {/* Cat Head */}
        <circle cx="100" cy="95" r="50" fill="#4B5563" />

        {/* Soft Face Cheeks Highlight */}
        <ellipse cx="72" cy="112" rx="9" ry="5.5" fill="#F472B6" opacity="0.4" />
        <ellipse cx="128" cy="112" rx="9" ry="5.5" fill="#F472B6" opacity="0.4" />

        {/* EYES LAYER */}
        {state === 'sleeping' ? (
          // Sleeping curved happy eyes
          <g stroke="#E5E7EB" strokeWidth="3.5" strokeLinecap="round">
            <path d="M 68 96 Q 78 104 88 96" />
            <path d="M 112 96 Q 122 104 132 96" />
          </g>
        ) : blink ? (
          // Blinking slit
          <g stroke="#1F2937" strokeWidth="3" strokeLinecap="round">
            <line x1="68" y1="95" x2="88" y2="95" />
            <line x1="112" y1="95" x2="132" y2="95" />
          </g>
        ) : (
          // Expressive round eyes with eye-tracking pupil offset
          <g>
            {/* Left Eye Sclera */}
            <circle cx="78" cy="94" r="14" fill="#FEF08A" stroke="#1F2937" strokeWidth="2" />
            {/* Left Pupil */}
            <circle
              cx={78 + eyeOffset.x}
              cy={94 + eyeOffset.y}
              r={state === 'attention' ? 8.5 : 6.5}
              fill="#111827"
              className="transition-all duration-75"
            />
            {/* Left Specular Glint */}
            <circle cx={75 + eyeOffset.x * 0.5} cy={90 + eyeOffset.y * 0.5} r="3" fill="#FFFFFF" />

            {/* Right Eye Sclera */}
            <circle cx="122" cy="94" r="14" fill="#FEF08A" stroke="#1F2937" strokeWidth="2" />
            {/* Right Pupil */}
            <circle
              cx={122 + eyeOffset.x}
              cy={94 + eyeOffset.y}
              r={state === 'attention' ? 8.5 : 6.5}
              fill="#111827"
              className="transition-all duration-75"
            />
            {/* Right Specular Glint */}
            <circle cx={119 + eyeOffset.x * 0.5} cy={90 + eyeOffset.y * 0.5} r="3" fill="#FFFFFF" />
          </g>
        )}

        {/* Nose */}
        <polygon points="96,106 104,106 100,111" fill="#F472B6" />

        {/* Mouth */}
        {state === 'speaking' ? (
          // Animated speaking mouth
          <ellipse cx="100" cy="116" rx="5" ry="4" fill="#BE185D" stroke="#1F2937" strokeWidth="1.5" />
        ) : (
          // Cute cat w-smile
          <path
            d="M 93 112 Q 97 117 100 112 Q 103 117 107 112"
            stroke="#1F2937"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Whiskers */}
        <g stroke="#E5E7EB" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
          {/* Left Whiskers */}
          <line x1="58" y1="108" x2="32" y2="104" />
          <line x1="58" y1="113" x2="30" y2="114" />
          <line x1="58" y1="118" x2="34" y2="124" />
          {/* Right Whiskers */}
          <line x1="142" y1="108" x2="168" y2="104" />
          <line x1="142" y1="113" x2="170" y2="114" />
          <line x1="142" y1="118" x2="166" y2="124" />
        </g>
      </svg>

      {/* Thinking sparkle / bubble dots */}
      {state === 'thinking' && (
        <div className="absolute -top-1 right-2 flex space-x-1 animate-pulse">
          <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
          <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
        </div>
      )}

      {/* Sleeping Zzz's */}
      {state === 'sleeping' && (
        <div className="absolute -top-3 right-3 text-xs font-bold text-indigo-400 select-none animate-bounce">
          Zzz...
        </div>
      )}
    </div>
  );
}
