import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import type { RenderSpec } from '@/lib/spec';
import { FONT } from './theme';

/**
 * The layer that does NOT cut.
 *
 * Every shot in this film was its own island: the chrome re-entered on each one, the
 * index counted up, and nothing carried across a boundary. Six unrelated frames butt-joined
 * is what "assembled" looks like, against "authored".
 *
 * The measured ad DNA's first principle is morphs not cuts — elements travelling across
 * shot boundaries. A full morph is out of reach here, but the cheap version of the same
 * idea works: put a small amount of the frame OUTSIDE the shot system entirely, so it
 * persists through every cut and is visibly the same object before and after.
 *
 * Three things live here now:
 *   the repo name    fixed for the whole film, never re-animating
 *   a progress rule  crossing the frame once, over the entire duration
 *   the shot ticks   marks on that rule at each cut, so the rule is also the edit
 *
 * The rule is the signature move. It is the one element that a viewer can follow from the
 * first frame to the last, and because it advances continuously it also guarantees the
 * frame is never completely static — which measured as 48.9% still before any of this.
 */
export const Continuity: React.FC<{ spec: RenderSpec; frameWidth: number }> = ({
  spec,
  frameWidth,
}) => {
  const frame = useCurrentFrame();
  const progress = spec.durationInFrames > 0 ? frame / spec.durationInFrames : 0;

  /**
   * The layer persists, but its CONTRAST cannot.
   *
   * A fixed white hairline is invisible over a paper ground, and a fixed dark one
   * disappears over ink. So the element keeps its position, size and meaning across every
   * cut — which is what makes it read as one continuous object — and only its colour
   * follows whichever ground it is currently sitting on. Real chrome does exactly this.
   */
  const active =
    spec.shots.find(
      (sh) => frame >= sh.startFrame && frame < sh.startFrame + sh.durationInFrames
    ) ?? spec.shots[0];
  const onLight = active?.tone === 'paper';
  const railBase = onLight ? 'rgba(10,20,10,0.16)' : 'rgba(255,255,255,0.14)';
  const tickIdle = onLight ? 'rgba(10,20,10,0.26)' : 'rgba(255,255,255,0.22)';
  const nameInk = onLight ? 'rgba(10,20,10,0.52)' : 'rgba(255,255,255,0.42)';

  // The rule sits over ink and paper alike, so it is drawn in the accent rather than in
  // either ground's figure colour, and kept quiet enough not to compete.
  const RAIL_LEFT = 132;
  const railWidth = frameWidth - RAIL_LEFT * 2;

  // Fades in after the first beat and out before the last, so it frames the film rather
  // than bracketing it.
  const presence = interpolate(
    frame,
    [0, 22, spec.durationInFrames - 26, spec.durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: presence }}>
      {/* The rail: a hairline the full measure, with the travelled part in accent. */}
      <div
        style={{
          position: 'absolute',
          left: RAIL_LEFT,
          bottom: 96,
          width: railWidth,
          height: 2,
          background: railBase,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: RAIL_LEFT,
          bottom: 96,
          width: railWidth * progress,
          height: 2,
          background: spec.accent,
        }}
      />

      {/* A tick at every cut, so the rail carries the edit rather than just the clock. */}
      {spec.shots.slice(1).map((shot, i) => {
        const at = shot.startFrame / spec.durationInFrames;
        const passed = progress >= at;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: RAIL_LEFT + railWidth * at,
              bottom: 92,
              width: 2,
              height: 10,
              background: passed ? spec.accent : tickIdle,
            }}
          />
        );
      })}

      {/* The name, fixed. It does not re-enter, which is the entire point of it. */}
      <div
        style={{
          position: 'absolute',
          left: RAIL_LEFT,
          bottom: 118,
          fontFamily: FONT.mono,
          fontSize: 19,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: nameInk,
        }}
      >
        {spec.repo}
      </div>
    </div>
  );
};
