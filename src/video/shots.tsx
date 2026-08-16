import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { RenderShot } from '@/lib/spec';
import { FONT, tokensFor } from './theme';
import { cameraOffset, entrance, stagger, typedLength } from './motion';

/**
 * The shot vocabulary.
 *
 * Rules that shape every component below, all of them measured rather than guessed:
 *  - NO z-index. @remotion/web-renderer ignores it; layering is DOM order, back to front.
 *  - NO backdrop-filter, NO mix-blend-mode. Both are silently dropped.
 *  - Massive negative space. A small subject in a large field reads as expensive;
 *    filling the frame reads as a slide deck.
 *  - Big display statement against a tiny mono caption. The scale contrast IS the design.
 */

type ShotProps = {
  shot: RenderShot;
  accent: string;
  local: number; // frames since this shot started
};

const FILL: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '0 132px',
};

/** Tiny uppercase mono line. The quiet half of the scale contrast. */
const Caption: React.FC<{ text: string; colour: string; delay: number; local: number }> = ({
  text,
  colour,
  delay,
  local,
}) => {
  const e = entrance(local, delay);
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 21,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: colour,
        opacity: e.opacity,
        transform: `translateY(${e.y * 0.4}px)`,
        marginTop: 34,
      }}
    >
      {text}
    </div>
  );
};

/** Words assemble with a stagger rather than the line fading in as a block. */
const KineticLine: React.FC<{
  text: string;
  local: number;
  colour: string;
  size: number;
  weight?: number;
  tracking?: string;
}> = ({ text, local, colour, size, weight = 600, tracking = '-0.035em' }) => (
  <div
    style={{
      fontFamily: FONT.display,
      fontSize: size,
      fontWeight: weight,
      lineHeight: 0.94,
      letterSpacing: tracking,
      color: colour,
      display: 'flex',
      flexWrap: 'wrap',
      gap: `0 ${size * 0.24}px`,
    }}
  >
    {text.split(' ').map((word, i) => {
      const e = entrance(local, stagger(i));
      return (
        <span
          key={`${word}-${i}`}
          style={{ display: 'inline-block', opacity: e.opacity, transform: `translateY(${e.y}px)` }}
        >
          {word}
        </span>
      );
    })}
  </div>
);

const BigType: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  return (
    <div style={FILL}>
      <KineticLine text={shot.text} local={local} colour={t.fg} size={132} />
      {shot.caption && <Caption text={shot.caption} colour={t.dim} delay={10} local={local} />}
    </div>
  );
};

/** One word, wider than the canvas. Deliberately clipped — the frame cannot hold it. */
const Blowout: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  const e = entrance(local, 0, 18);
  return (
    <div style={{ ...FILL, padding: 0, justifyContent: 'center', overflow: 'hidden' }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 420,
          fontWeight: 700,
          letterSpacing: '-0.06em',
          lineHeight: 0.8,
          color: t.fg,
          whiteSpace: 'nowrap',
          transform: `translateX(${-60 + e.t * 60}px) scale(${0.94 + e.t * 0.06})`,
          opacity: e.opacity,
          marginLeft: -40,
        }}
      >
        {shot.text.toUpperCase()}
      </div>
    </div>
  );
};

/** Per-character reveal with a caret that sits exactly after the last glyph. */
const TypeOn: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  const shown = typedLength(local, shot.text.length);
  const caretOn = Math.floor(local / 8) % 2 === 0 || shown < shot.text.length;
  return (
    <div style={FILL}>
      <div style={{ fontFamily: FONT.mono, fontSize: 76, color: t.fg, letterSpacing: '-0.02em' }}>
        {shot.text.slice(0, shown)}
        <span style={{ color: t.pop(accent), opacity: caretOn ? 1 : 0 }}>▌</span>
      </div>
      {shot.caption && <Caption text={shot.caption} colour={t.dim} delay={16} local={local} />}
    </div>
  );
};

/**
 * The developer's real commit subjects. The single most personal thing in any repo —
 * nobody else's commit log looks like this, which is exactly why it cannot be generic.
 */
const CommitWall: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  const subjects = shot.payload?.type === 'commits' ? shot.payload.subjects : [];
  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 19,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: t.pop(accent),
          opacity: entrance(local).opacity,
          marginBottom: 40,
        }}
      >
        {shot.text}
      </div>
      {subjects.map((subject, i) => {
        const e = entrance(local, stagger(i, 2.5));
        return (
          <div
            key={i}
            style={{
              fontFamily: FONT.mono,
              fontSize: 34,
              lineHeight: 1.65,
              color: i === 0 ? t.fg : t.dim,
              opacity: e.opacity,
              transform: `translateY(${e.y * 0.5}px)`,
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
const Code: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  const payload = shot.payload?.type === 'code' ? shot.payload : null;
  const lines = payload?.lines ?? [];
  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', marginBottom: 30 }}>
        <span
          style={{
            fontFamily: FONT.display,
            fontSize: 46,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            color: t.fg,
            opacity: entrance(local).opacity,
          }}
        >
          {shot.text}
        </span>
        {payload && (
          <span
            style={{
              fontFamily: FONT.mono,
              fontSize: 19,
              letterSpacing: '0.1em',
              color: t.pop(accent),
              opacity: entrance(local, 6).opacity,
            }}
          >
            {payload.path}
          </span>
        )}
      </div>
      {lines.map((line, i) => {
        const e = entrance(local, stagger(i, 1.8));
        return (
          <div
            key={i}
            style={{
              fontFamily: FONT.mono,
              fontSize: 25,
              lineHeight: 1.55,
              color: t.dim,
              opacity: e.opacity * 0.95,
              whiteSpace: 'pre',
              overflow: 'hidden',
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
const Stat: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  const e = entrance(local, 0, 16);
  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 250,
          fontWeight: 700,
          letterSpacing: '-0.055em',
          lineHeight: 0.86,
          color: t.pop(accent),
          opacity: e.opacity,
          transform: `translateY(${e.y}px)`,
        }}
      >
        {shot.text}
      </div>
      {shot.caption && <Caption text={shot.caption} colour={t.dim} delay={9} local={local} />}
    </div>
  );
};

/** Cards dropping in with overshoot. Good for three things that belong together. */
const Stack: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  const items = shot.text.split(/[,·|]/).map((s) => s.trim()).filter(Boolean);
  const cards = items.length > 1 ? items : [shot.text];
  return (
    <div style={{ ...FILL, justifyContent: 'center', gap: 18 }}>
      {cards.map((item, i) => {
        const e = entrance(local, stagger(i, 5), 16);
        return (
          <div
            key={i}
            style={{
              border: `1px solid ${t.rule}`,
              borderRadius: 14,
              padding: '30px 40px',
              fontFamily: FONT.display,
              fontSize: 54,
              fontWeight: 550,
              letterSpacing: '-0.03em',
              color: t.fg,
              opacity: e.opacity,
              transform: `translateY(${e.y * 1.4}px)`,
              alignSelf: 'flex-start',
              marginLeft: i * 56,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
};

/** The ending. Name, a rule, one line. Always the last shot. */
const Lockup: React.FC<ShotProps> = ({ shot, accent, local }) => {
  const t = tokensFor(shot.tone, accent);
  const e = entrance(local, 0, 18);
  const rule = entrance(local, 8, 20);
  return (
    <div style={{ ...FILL, justifyContent: 'center', alignItems: 'flex-start' }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 168,
          fontWeight: 650,
          letterSpacing: '-0.05em',
          color: t.fg,
          opacity: e.opacity,
          transform: `translateY(${e.y}px)`,
        }}
      >
        {shot.text}
      </div>
      <div
        style={{
          height: 2,
          width: `${rule.t * 46}%`,
          background: t.pop(accent),
          margin: '38px 0 30px',
        }}
      />
      {shot.caption && (
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 24,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: t.dim,
            opacity: entrance(local, 16).opacity,
          }}
        >
          {shot.caption}
        </div>
      )}
    </div>
  );
};

const REGISTRY = {
  bigtype: BigType,
  blowout: Blowout,
  typeon: TypeOn,
  commitwall: CommitWall,
  code: Code,
  stat: Stat,
  stack: Stack,
  lockup: Lockup,
} as const;

/**
 * One shot, standing on its full-bleed ground, with the camera travelling linearly
 * across it. The ground travels WITH the camera — a shot that is a small lit island on a
 * black stage measured 6% of the frame above luminance 40, and a whole-frame motion
 * metric then scores 94% of every frame at exactly zero.
 */
export const ShotFrame: React.FC<{ shot: RenderShot; accent: string }> = ({ shot, accent }) => {
  const frame = useCurrentFrame();
  const local = frame - shot.startFrame;
  const t = tokensFor(shot.tone, accent);
  const Component = REGISTRY[shot.kind];
  const dy = cameraOffset(local, shot.durationInFrames, shot.cameraDy);

  return (
    <div style={{ position: 'absolute', inset: 0, background: t.bg, overflow: 'hidden' }}>
      {/* ground + content move together; oversized so travel never exposes an edge */}
      <div style={{ position: 'absolute', inset: '-12% 0', transform: `translateY(${dy}px)` }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          <Component shot={shot} accent={accent} local={local} />
        </div>
      </div>
    </div>
  );
};
