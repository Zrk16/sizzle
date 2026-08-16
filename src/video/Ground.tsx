import React from 'react';
import { tokensFor } from './theme';
import type { Shot } from '@/lib/spec';

/**
 * What a shot stands on.
 *
 * A flat fill is why generated video looks generated. Four cheap layers turn a colour
 * into a surface, and every one of them is a measured principle rather than decoration:
 *
 *   wash     — flat depth (principle 5). A single off-centre radial makes the ground
 *              recede. No 3D, no perspective; just falloff.
 *   motif    — the recurring geometric system (principle 6). One enormous soft disc,
 *              placed differently per shot, is the through-line that makes six unrelated
 *              frames read as one film.
 *   vignette — pulls the corners down so the eye lands centre-frame.
 *   grain    — craft texture (principle 9). A STATIC tile, deliberately: procedural
 *              noise re-evaluated per frame cost a 54-minute render once, and under
 *              motion blur it is sampled once per blur step on top of that.
 *
 * All four are transform/opacity-free and use no backdrop-filter, mix-blend-mode or
 * z-index, because the browser renderer silently drops all three. Layering is DOM order.
 */

/** 160x160 of monochrome noise, base64. Static — never regenerated per frame. */
const GRAIN =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter>
      <rect width="160" height="160" filter="url(#n)" opacity="0.42"/>
    </svg>`
  );

export const Ground: React.FC<{
  tone: Shot['tone'];
  accent: string;
  /** Shot index — moves the motif so consecutive frames are not the same picture. */
  index: number;
}> = ({ tone, accent, index }) => {
  const t = tokensFor(tone, accent);

  // The motif walks a fixed path across the film rather than landing randomly, so its
  // recurrence reads as intent instead of noise.
  const spots = [
    { x: 78, y: 22 },
    { x: 18, y: 74 },
    { x: 62, y: 84 },
    { x: 26, y: 18 },
    { x: 88, y: 58 },
    { x: 44, y: 12 },
    { x: 12, y: 44 },
  ];
  const spot = spots[index % spots.length];

  // On a flood ground the accent IS the ground, so the motif has to be light or dark
  // rather than accent-coloured or it disappears into itself.
  const motifColour =
    tone === 'flood'
      ? t.fg === '#FFFFFF'
        ? 'rgba(255,255,255,0.10)'
        : 'rgba(10,10,12,0.09)'
      : tone === 'ink'
        ? `color-mix(in srgb, ${accent} 22%, transparent)`
        : `color-mix(in srgb, ${accent} 16%, transparent)`;

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: t.bg }} />

      {/* motif — one enormous soft disc, the recurring geometry */}
      <div
        style={{
          position: 'absolute',
          left: `${spot.x}%`,
          top: `${spot.y}%`,
          width: '95%',
          aspectRatio: '1',
          translate: '-50% -50%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${motifColour} 0%, transparent 68%)`,
        }}
      />

      {/* wash — off-centre falloff so the ground has a near side and a far side */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            tone === 'ink'
              ? 'radial-gradient(120% 90% at 28% 12%, rgba(255,255,255,0.075) 0%, transparent 62%)'
              : tone === 'paper'
                ? 'radial-gradient(120% 90% at 24% 8%, rgba(255,255,255,0.85) 0%, transparent 58%)'
                : 'radial-gradient(130% 95% at 30% 10%, rgba(255,255,255,0.20) 0%, transparent 60%)',
        }}
      />

      {/* vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            tone === 'paper'
              ? 'radial-gradient(115% 85% at 50% 45%, transparent 52%, rgba(10,10,12,0.13) 100%)'
              : 'radial-gradient(115% 85% at 50% 45%, transparent 48%, rgba(0,0,0,0.42) 100%)',
        }}
      />

      {/* grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${GRAIN}")`,
          backgroundSize: '160px 160px',
          opacity: tone === 'paper' ? 0.055 : 0.085,
        }}
      />
    </>
  );
};
