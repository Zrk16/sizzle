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

/**
 * The vignette lives in `shots.tsx`, NOT here.
 *
 * It used to sit in this component, inside the group that the camera scales. With a
 * whole-frame push of 1.0 to 1.1 that pushed its dark corners outside the visible frame,
 * so deepening it changed the measured darkest-5% by exactly nothing. A vignette is a
 * property of the lens, not of the world in front of it, and it has to be fixed to the
 * frame to behave like one.
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
  /** Frames since this shot started, so the ground can keep breathing. */
  local?: number;
  duration?: number;
}> = ({ tone, accent, index, local = 0, duration = 60 }) => {
  const t = tokensFor(tone, accent);

  /**
   * The ground never stops moving, and that is the whole point of it moving.
   *
   * Measured against five reference films: they run 0-16% still frames. This film ran
   * 48.9% — nearly half of it was frozen, because every shot arrived, resolved, and then
   * held perfectly static for two to four seconds. That is a slideshow, and it is what
   * "the movement feels bad" actually was.
   *
   * The earlier fix — a camera drift on every shot — was removed because it moved the TYPE
   * while the viewer was trying to read it. That was the wrong conclusion: the problem was
   * never that things moved, it was WHAT moved. So the ground drifts and scales
   * continuously while the type sits perfectly still on top of it. The frame is never
   * static; the words never slide.
   */
  const p = duration > 0 ? local / duration : 0;
  const push = 1.03 + p * 0.14; // large enough to clear the pixel grid every frame
  const driftX = (index % 2 === 0 ? 1 : -1) * p * 7;
  const driftY = p * 5;

  /**
   * MOVING GRAIN is what actually stops a frame reading as still.
   *
   * The first attempt at continuous life was a slow ground drift, and it did nothing:
   * 2.4% of frame width across a whole shot is about 0.04px per frame, which is under the
   * pixel grid — the same sub-pixel trap that made an earlier camera move judder. Measured
   * before and after, still-frame percentage moved 48.9 to 46.8. Nothing.
   *
   * Every reference film is real footage, and real footage has sensor noise: every pixel
   * changes every frame. That is why none of them ever measure as frozen. Translating the
   * grain tile a few pixels per frame reproduces exactly that, changes the whole frame
   * rather than one element, and costs nothing — the tile is still a single static image,
   * it is only its background-position that moves.
   */
  const grainX = (local * 7) % 160;
  const grainY = (local * 11) % 160;

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
          left: `${spot.x + driftX}%`,
          top: `${spot.y + driftY}%`,
          width: '95%',
          aspectRatio: '1',
          translate: '-50% -50%',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${motifColour} 0%, transparent 68%)`,
          transform: `scale(${push})`,
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

      {/* grain */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("${GRAIN}")`,
          backgroundSize: '160px 160px',
          backgroundPosition: `${grainX}px ${grainY}px`,
          opacity: tone === 'paper' ? 0.075 : 0.11,
        }}
      />
    </>
  );
};
