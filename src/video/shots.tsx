import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { RenderShot } from '@/lib/spec';
import { FONT, tokensFor } from './theme';
import { Ground } from './Ground';
import { fitText } from './fit';
import { ENERGY, cameraOffset, entrance, stagger, type Energy } from './motion';
import { Artwork, Bento, Pointer } from './shots-ui';

/**
 * The shot vocabulary. Five kinds, down from eight.
 *
 * Rules that shape every component here, all measured rather than guessed:
 *  - NO z-index, NO backdrop-filter, NO mix-blend-mode. The browser renderer drops all
 *    three silently. Layering is DOM order, back to front.
 *  - EVERY piece of display type goes through `fitText`. Sizes used to be constants while
 *    the schema allowed 34-character strings, so four out of five real strings overflowed
 *    the frame. Size is derived from the string now, so overflow is not possible.
 *  - Big display statement against a tiny mono label. The scale contrast IS the design.
 */

/** Side gutter on the logical canvas. */
const GUTTER = 132;

type ShotProps = {
  shot: RenderShot;
  accent: string;
  local: number;
  energy: Energy;
  /** Logical frame width, so type is fitted to the real measure. */
  frameWidth: number;
};

const FILL: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: `0 ${GUTTER}px`,
};

/** The quiet half of the scale contrast. Every display block gets one. */
const Label: React.FC<{
  text: string;
  colour: string;
  local: number;
  energy: Energy;
  delay?: number;
}> = ({ text, colour, local, energy, delay = 0 }) => (
  <div
    style={{
      fontFamily: FONT.mono,
      fontSize: 20,
      letterSpacing: '0.2em',
      textTransform: 'uppercase',
      color: colour,
      opacity: entrance(local, delay, energy).opacity,
      marginBottom: 30,
    }}
  >
    {text}
  </div>
);

/** Fitted display type, revealed line by line. */
const Lines: React.FC<{
  lines: string[];
  fontSize: number;
  colour: string;
  local: number;
  energy: Energy;
  delay?: number;
  weight?: number;
  lineHeight?: number;
}> = ({ lines, fontSize, colour, local, energy, delay = 0, weight = 800, lineHeight = 1.02 }) => (
  <div
    style={{
      fontFamily: FONT.display,
      fontSize,
      fontWeight: weight,
      lineHeight,
      letterSpacing: '-0.035em',
      color: colour,
    }}
  >
    {lines.map((line, i) => {
      const e = entrance(local, delay + stagger(i, 4), energy);
      return (
        <div key={i} style={{ opacity: e.opacity, transform: `translateY(${e.y}px)` }}>
          {line}
        </div>
      );
    })}
  </div>
);

/**
 * The claim. The one shot allowed a full sentence, and the reason the film explains
 * anything at all. Set at reading size rather than display size on purpose: this is the
 * moment the film asks to be READ, and a sentence at display scale is a wall.
 */
const Claim: React.FC<ShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const fit = fitText(shot.text, {
    boxWidth: frameWidth - GUTTER * 2,
    ideal: 88,
    min: 44,
    maxLines: 3,
    lineHeight: 1.14,
  });
  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <Label text="What it is" colour={t.pop(accent)} local={local} energy={energy} />
      <Lines
        lines={fit.lines}
        fontSize={fit.fontSize}
        colour={t.fg}
        local={local}
        energy={energy}
        delay={5}
        weight={600}
        lineHeight={1.14}
      />
    </div>
  );
};

/** The display statement. Short copy, set as large as it will go. */
const BigType: React.FC<ShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const fit = fitText(shot.text, {
    boxWidth: frameWidth - GUTTER * 2,
    ideal: 230,
    min: 72,
    maxLines: 3,
  });
  return (
    <div style={FILL}>
      <Lines lines={fit.lines} fontSize={fit.fontSize} colour={t.fg} local={local} energy={energy} />
      {shot.caption && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 21,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: t.dim,
            marginTop: 32,
            opacity: entrance(local, 10, energy).opacity,
          }}
        >
          {shot.caption}
        </div>
      )}
    </div>
  );
};

/**
 * The developer's real commit subjects. The most personal thing in any repo — nobody
 * else's commit log looks like this, which is exactly why it cannot read generic.
 */
const CommitWall: React.FC<ShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const subjects = shot.payload?.type === 'commits' ? shot.payload.subjects : [];
  const width = frameWidth - GUTTER * 2;
  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <Label text={shot.text} colour={t.pop(accent)} local={local} energy={energy} />
      {subjects.map((subject, i) => {
        const e = entrance(local, stagger(i, 2.5), energy);
        return (
          <div
            key={i}
            style={{
              fontFamily: FONT.mono,
              fontSize: 38,
              lineHeight: 1.6,
              color: i === 0 ? t.fg : t.dim,
              opacity: e.opacity,
              transform: `translateY(${e.y * 0.5}px)`,
              maxWidth: width,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subject}
          </div>
        );
      })}
    </div>
  );
};

/** Real source from the repo, revealed line by line. Never paraphrased by the model. */
const Code: React.FC<ShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const payload = shot.payload?.type === 'code' ? shot.payload : null;
  const lines = payload?.lines ?? [];
  const width = frameWidth - GUTTER * 2;

  // Code is monospaced, so the longest line dictates the size exactly. No estimating.
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const size = Math.max(18, Math.min(28, Math.floor(width / (longest * 0.6))));

  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', marginBottom: 26 }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 20,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: t.pop(accent),
            opacity: entrance(local, 0, energy).opacity,
          }}
        >
          {shot.text}
        </span>
        {payload && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 18,
              color: t.dim,
              opacity: entrance(local, 5, energy).opacity,
            }}
          >
            {payload.path}
          </span>
        )}
      </div>
      {lines.map((line, i) => {
        const e = entrance(local, stagger(i, 1.8), energy);
        return (
          <div
            key={i}
            style={{
              fontFamily: FONT.mono,
              fontSize: size,
              lineHeight: 1.55,
              color: t.dim,
              opacity: e.opacity * 0.95,
              whiteSpace: 'pre',
            }}
          >
            {line || ' '}
          </div>
        );
      })}
    </div>
  );
};

/** One number. Punctuation, never the payoff — the schema allows it at most once. */
const Stat: React.FC<ShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const fit = fitText(shot.text, {
    boxWidth: frameWidth - GUTTER * 2,
    ideal: 340,
    min: 96,
    maxLines: 2,
  });
  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <Lines
        lines={fit.lines}
        fontSize={fit.fontSize}
        colour={t.pop(accent)}
        local={local}
        energy={energy}
      />
      {shot.caption && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 21,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: t.dim,
            marginTop: 28,
            opacity: entrance(local, 8, energy).opacity,
          }}
        >
          {shot.caption}
        </div>
      )}
    </div>
  );
};

/** The ending. Name, a rule, one line. Always last. */
const Lockup: React.FC<ShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const fit = fitText(shot.text, {
    boxWidth: frameWidth - GUTTER * 2,
    ideal: 300,
    min: 96,
    maxLines: 2,
  });
  const rule = entrance(local, 8, energy);
  return (
    <div style={{ ...FILL, justifyContent: 'center', alignItems: 'flex-start' }}>
      <Lines lines={fit.lines} fontSize={fit.fontSize} colour={t.fg} local={local} energy={energy} />
      <div
        style={{
          height: 3,
          width: `${rule.t * 42}%`,
          background: t.pop(accent),
          margin: '36px 0 28px',
        }}
      />
      {shot.caption && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 24,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: t.dim,
            opacity: entrance(local, 16, energy).opacity,
          }}
        >
          {shot.caption}
        </div>
      )}
    </div>
  );
};

/**
 * Frame chrome — the index marker.
 *
 * Sits OUTSIDE the travelling group deliberately: the camera moves the world, the chrome
 * is fixed to the frame. Something static at the edge is what tells the eye the rest is
 * moving.
 */
const ShotChrome: React.FC<{
  index: number;
  total: number;
  label: string;
  colour: string;
  accent: string;
  local: number;
}> = ({ index, total, label, colour, accent, local }) => {
  const e = entrance(local, 4, 'standard');
  const mono: React.CSSProperties = {
    fontFamily: FONT.mono,
    fontSize: 20,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    opacity: e.opacity * 0.9,
  };
  return (
    <>
      <div style={{ position: 'absolute', top: 64, left: GUTTER, ...mono, color: accent }}>
        {String(index + 1).padStart(2, '0')}
        <span style={{ color: colour, opacity: 0.45 }}> / {String(total).padStart(2, '0')}</span>
      </div>
    </>
  );
};

const REGISTRY = {
  claim: Claim,
  bigtype: BigType,
  commitwall: CommitWall,
  code: Code,
  stat: Stat,
  bento: Bento,
  pointer: Pointer,
  artwork: Artwork,
  lockup: Lockup,
} as const;

/**
 * Resting 3D tilt — the single loudest thing separating this from professional work.
 *
 * Measured across 24 hand-built reference templates, 145 of 505 visual layers rest tilted
 * over 2 degrees, clustering around 45. A flat face-on layout is a choice there, not the
 * default; here it had been the only option, and a flat frame is what "made by a program"
 * looks like.
 *
 * Two departures from that 45-degree figure, both deliberate:
 *
 * Only MEDIA shots lean. In the reference set the tilted layers are screenshots, cards and
 * shapes — headline text is repeatedly left flat, and for good reason: a sentence rotated
 * far enough to read as 3D stops being readable, and every one of those films puts exactly
 * one text idea on screen at a time precisely so it CAN be read. Type stays square here.
 *
 * The angles are smaller than 45. Those films lean hard because a real camera dollies past
 * the layer, so perspective changes across the move and sells the depth. This camera only
 * travels ~112px, so the same angle would read as a static skew — a still photograph of a
 * tilted thing rather than an object in space. These are set to the largest lean that still
 * reads as depth under our much smaller move.
 *
 * Rendered, looked at, and cut back. The first version leaned `code` and `commitwall` too,
 * and both were worse: a tilted block of source reads as a slanted photocopy, not an object
 * in space, and it loses contrast as the far edge recedes. The reference rule turned out to
 * be load-bearing exactly as written — the layers that lean are CARDS, PANELS and IMAGES,
 * things with an edge and a surface. Raw text has neither, so there is nothing for the eye
 * to read the perspective against.
 *
 * What survives is the two shots whose content IS a surface: the bento cards, and the
 * repo's own artwork.
 */
const TILT: Partial<Record<RenderShot['kind'], string>> = {
  artwork: 'rotateX(12deg) rotateY(-8deg)',
  bento: 'rotateX(19deg) rotateY(-6deg)',
};

export const ShotFrame: React.FC<{
  shot: RenderShot;
  accent: string;
  index: number;
  total: number;
  repo: string;
  frameWidth: number;
}> = ({ shot, accent, index, total, repo, frameWidth }) => {
  // `useCurrentFrame` inside a <Sequence> is ALREADY relative to that sequence's start.
  // Subtracting startFrame again drove every shot after the first to a negative frame,
  // which clamped its entrance to opacity 0 — shot one played and the rest went blank.
  const local = useCurrentFrame();
  const t = tokensFor(shot.tone, accent);
  const Component = REGISTRY[shot.kind];
  const energy = ENERGY[shot.kind] ?? 'standard';
  const dy = cameraOffset(local, shot.durationInFrames, shot.cameraDy);

  /**
   * A slow continuous push across the WHOLE frame — ground and content together.
   *
   * Measured against five reference films, they run 0-16% still frames; this ran 48.9%.
   * Two attempts to fix it failed and both failed the same way: a ground drift and then
   * moving grain, each too small to survive the measurement, which downsamples to 160px.
   * Grain especially — it averages away completely at that scale, which is also roughly
   * what happens to it on a phone.
   *
   * What every reference actually has is a camera that never stops. So does this now.
   * Amplitude is set so the frame edges travel about 1px per frame: below that the
   * renderer quantises the motion into a periodic lurch, and above about 1.5px/frame it
   * starts to pull focus from the type. A uniform scale does not hurt readability the way
   * the earlier per-shot drift did, because nothing moves relative to anything else.
   */
  const pushProgress = shot.durationInFrames > 0 ? local / shot.durationInFrames : 0;
  const push = 1 + pushProgress * (shot.camera === 'push' ? 0.55 : 0.1);

  return (
    <div style={{ position: 'absolute', inset: 0, background: t.bg, overflow: 'hidden' }}>
      {/* Ground and content travel together. A shot that is a small lit island on a dark
          stage measured 6% of the frame above luminance 40, and a whole-frame motion
          metric then scores 94% of every frame at exactly zero. */}
      <div
        style={{
          position: 'absolute',
          inset: '-12% 0',
          transform: `translateY(${dy}px) scale(${push})`,
          transformOrigin: '50% 50%',
          // The plane the tilt is read against. Without a perspective ancestor a rotateX is
          // an affine squash, not a lean — the far edge has to actually get smaller.
          perspective: TILT[shot.kind] ? '1900px' : undefined,
          perspectiveOrigin: '50% 42%',
        }}
      >
        <Ground
          tone={shot.tone}
          accent={accent}
          index={index}
          local={local}
          duration={shot.durationInFrames}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: TILT[shot.kind] ?? undefined,
            transformOrigin: '50% 50%',
          }}
        >
          <Component
            shot={shot}
            accent={accent}
            local={local}
            energy={energy}
            frameWidth={frameWidth}
          />
        </div>
      </div>

      {/* Vignette, fixed to the FRAME so the camera push cannot carry its corners out of
          shot. Deep on dark grounds: measured darkest-5% was 14 against a reference range
          of 0-4, and real blacks are the strongest expensive-looking tell in that set. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            shot.tone === 'paper'
              ? 'radial-gradient(116% 86% at 50% 45%, transparent 42%, rgba(10,10,12,0.34) 100%)'
              : 'radial-gradient(116% 86% at 50% 45%, transparent 34%, rgba(0,0,0,0.92) 100%)',
        }}
      />

      <ShotChrome
        index={index}
        total={total}
        label={repo}
        colour={t.fg}
        accent={t.pop(accent)}
        local={local}
      />
    </div>
  );
};
