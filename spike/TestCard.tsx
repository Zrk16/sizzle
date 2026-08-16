import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

/**
 * Each panel isolates ONE feature the web-renderer docs flag as risky or unknown.
 * `TestCardInner` takes frame as a plain prop so the same markup can be mounted in
 * ordinary DOM as the reference image. `TestCard` is the Remotion-context version
 * that actually gets rendered. Any feature the renderer silently drops shows up as
 * a visible diff between the two instead of a guess.
 */

const panel: React.CSSProperties = {
  position: 'relative',
  width: 420,
  height: 220,
  borderRadius: 16,
  overflow: 'hidden',
  fontFamily: 'monospace',
  fontSize: 20,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 16,
  boxSizing: 'border-box',
};

const label: React.CSSProperties = {
  position: 'absolute',
  top: 10,
  left: 14,
  fontSize: 14,
  letterSpacing: 1,
  opacity: 0.75,
};

export const TestCardInner: React.FC<{ frame: number }> = ({ frame }) => {
  // Baseline motion — transform + opacity are the two things that must work.
  const x = interpolate(frame, [0, 60], [-40, 40], { extrapolateRight: 'clamp' });
  const fade = interpolate(frame, [0, 30], [0.3, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0b0b0f',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 420px)',
        gridAutoRows: 220,
        gap: 24,
        alignContent: 'center',
        justifyContent: 'center',
        padding: 40,
        boxSizing: 'border-box',
      }}
    >
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="spikeBlur">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </svg>

      {/* 1. BASELINE — transform + opacity. If this breaks, nothing works. */}
      <div style={{ ...panel, background: '#1d4ed8' }}>
        <span style={label}>1 baseline</span>
        <span style={{ transform: `translateX(${x}px)`, opacity: fade }}>
          transform + opacity
        </span>
      </div>

      {/* 2. BACKDROP-FILTER — documented unsupported. Powers fx/Surface glass. */}
      <div style={{ ...panel, background: 'linear-gradient(135deg,#f43f5e,#f59e0b)' }}>
        <span style={label}>2 backdrop-filter</span>
        <div
          style={{
            position: 'absolute',
            inset: 40,
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 12,
          }}
        />
        <span style={{ position: 'relative' }}>glass should blur</span>
      </div>

      {/* 3. MIX-BLEND-MODE — documented unsupported. */}
      <div style={{ ...panel, background: '#065f46' }}>
        <span style={label}>3 mix-blend-mode</span>
        <div
          style={{
            position: 'absolute',
            inset: 30,
            background: '#f59e0b',
            mixBlendMode: 'difference',
          }}
        />
        <span style={{ position: 'relative' }}>should invert</span>
      </div>

      {/* 4. Z-INDEX — unsupported per docs. Red is LATER in DOM but z-index says blue wins. */}
      <div style={{ ...panel, background: '#3f3f46' }}>
        <span style={label}>4 z-index</span>
        <div style={{ position: 'absolute', inset: 50, background: '#2563eb', zIndex: 2 }} />
        <div style={{ position: 'absolute', inset: 80, background: '#dc2626', zIndex: 1 }} />
        <span style={{ position: 'relative', zIndex: 3 }}>blue over red</span>
      </div>

      {/* 5. SVG url() FILTER — documented unsupported. */}
      <div style={{ ...panel, background: '#4c1d95' }}>
        <span style={label}>5 svg url() filter</span>
        <span style={{ filter: 'url(#spikeBlur)', fontSize: 28 }}>should be blurry</span>
      </div>

      {/* 6. CSS FILTER — supported Chrome/Firefox, NOT Safari. */}
      <div style={{ ...panel, background: '#7c2d12' }}>
        <span style={label}>6 css filter</span>
        <span style={{ filter: 'blur(4px) brightness(1.6)', fontSize: 28 }}>css blur</span>
      </div>
    </div>
  );
};

export const TestCard: React.FC = () => <TestCardInner frame={useCurrentFrame()} />;
