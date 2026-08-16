import React from 'react';

/**
 * Minimal isolation test. Four identical white blocks on black, in fixed quadrants.
 * The ONLY difference between them is the one CSS property under test. Counting white
 * pixels per quadrant in the rendered frame says unambiguously which property causes
 * an element to be dropped — no font metrics, no layout, no coordinate mapping.
 *
 * Quadrants: TL = plain (control) | TR = transform | BL = opacity | BR = filter
 */

const block: React.CSSProperties = {
  position: 'absolute',
  width: 120,
  height: 60,
  background: '#ffffff',
};

export const Isolate: React.FC = () => (
  <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative' }}>
    {/* TL — control, no compositing property at all */}
    <div style={{ ...block, left: 40, top: 40 }} />

    {/* TR — transform only */}
    <div style={{ ...block, left: 240, top: 40, transform: 'translateX(0px)' }} />

    {/* BL — opacity only */}
    <div style={{ ...block, left: 40, top: 140, opacity: 0.99 }} />

    {/* BR — css filter only */}
    <div style={{ ...block, left: 240, top: 140, filter: 'brightness(1.0)' }} />
  </div>
);
