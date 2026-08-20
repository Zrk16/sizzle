import React from 'react';
import { interpolate } from 'remotion';
import type { RenderShot } from '@/lib/spec';
import { FONT, tokensFor } from './theme';
import { entrance, stagger, type Energy } from './motion';

/**
 * The two shots that show INTERFACE rather than type.
 *
 * Ported from the reference engine. Everything else in this film is words on a ground,
 * and a launch video made entirely of type reads as a title sequence — the reference set
 * is mostly product surfaces with type used as punctuation, not the other way round.
 *
 * One substitution was forced by the renderer: the original glass leans on
 * `backdrop-filter`, which @remotion/web-renderer drops silently. The depth is carried
 * instead by the three things that do survive — a translucent vertical gradient, a bright
 * top hairline, and a two-layer shadow.
 */

export const GUTTER = 132;

export type UIShotProps = {
  shot: RenderShot;
  accent: string;
  local: number;
  energy: Energy;
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

/**
 * Bento — cards on a plane that eases toward square.
 *
 * The tilt EASES OPEN rather than sitting static. A fixed skew reads as a slide with a
 * transform on it; a plane settling toward square reads as a camera moving on an object.
 * Cards also sit at different depths, so the tilt parallaxes them apart instead of
 * shearing one flat plane — that difference is most of what separates this from a grid.
 *
 * Card content is never written by the model. A card grid is precisely the shape that
 * invites invented feature bullets, and invented features are the fastest way to make a
 * generated video worthless. These are languages, commit counts, topics: verifiable.
 */
export const Bento: React.FC<UIShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const cards = shot.payload?.type === 'cards' ? shot.payload.items : [];
  const light = shot.tone === 'paper';

  const open = interpolate(local, [0, 46], [1, 0.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (x) => 1 - Math.pow(1 - x, 3),
  });

  const surface = (hero: boolean): React.CSSProperties => {
    const lift = hero ? 1.15 : 0.9;
    return {
      /**
       * On a PAPER ground the original translucent-white glass rendered white-on-white:
       * the cards were barely distinguishable from the background they sat on. Light-mode
       * glass in the reference works because it floats over photography; over a plain
       * light ground it needs its own value separation, so it tints slightly COOL and
       * DOWN rather than staying near-white.
       */
      background: light
        ? 'linear-gradient(160deg, rgba(255,255,255,1) 0%, rgba(243,245,240,0.98) 46%, rgba(226,231,222,0.98) 100%)'
        : 'linear-gradient(160deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.055) 60%, rgba(255,255,255,0.022) 100%)',
      border: `1px solid ${light ? 'rgba(10,20,10,0.10)' : 'rgba(255,255,255,0.15)'}`,
      borderTopColor: light ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.32)',
      borderRadius: 30,
      // The shadow IS the depth: a wide ambient layer plus a tight contact one.
      boxShadow: light
        ? `0 ${44 * lift}px ${96 * lift}px rgba(10,20,10,0.26), 0 10px 22px rgba(10,20,10,0.18)`
        : `0 ${44 * lift}px ${96 * lift}px rgba(0,0,0,0.62), 0 10px 22px rgba(0,0,0,0.5)`,
    };
  };

  return (
    <div style={{ ...FILL, justifyContent: 'center' }}>
      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 20,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: t.pop(accent),
          opacity: entrance(local, 0, energy).opacity,
          marginBottom: 30,
        }}
      >
        {shot.text}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 22,
          maxWidth: frameWidth - GUTTER * 2,
          transform: `perspective(2000px) rotateY(${-9 * open}deg) rotateX(${5 * open}deg)`,
          transformOrigin: '50% 40%',
        }}
      >
        {cards.map((card, i) => {
          const e = entrance(local, 6 + stagger(i, 5), energy);
          const hero = i === 0;
          return (
            <div
              key={i}
              style={{
                ...surface(hero),
                gridColumn: hero ? '1 / -1' : 'auto',
                padding: hero ? '44px 46px' : '34px 36px',
                opacity: e.opacity,
                transform: `translateY(${e.y}px) translateZ(${hero ? 46 : 14 - i * 6}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 800,
                  fontSize: hero ? 82 : 54,
                  letterSpacing: '-0.035em',
                  lineHeight: 1,
                  color: t.fg,
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 19,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: t.dim,
                  marginTop: 14,
                }}
              >
                {card.note}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Pointer — a real cursor travelling to a button and pressing it.
 *
 * Two details carry the realism and both are cheap. The button DEPRESSES on contact — it
 * scales down and its shadow tightens — and the cursor OVERSHOOTS slightly before settling.
 * A cursor that glides to a dead stop on a button that does not react reads as a diagram
 * rather than as somebody using software.
 *
 * The inset top highlight is what makes a rounded rectangle read as a physical button
 * rather than a coloured box.
 */
export const Pointer: React.FC<UIShotProps> = ({ shot, accent, local, energy }) => {
  const t = tokensFor(shot.tone, accent);

  const travel = interpolate(local, [0, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (x) => 1 - Math.pow(1 - x, 4),
  });
  const overshoot = interpolate(local, [20, 26, 34], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const press = interpolate(local, [30, 34, 44], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const x = interpolate(travel, [0, 1], [-300, 22]) + overshoot * 8;
  const y = interpolate(travel, [0, 1], [280, 30]) + overshoot * 5;

  // On a flood ground an accent-coloured button is invisible against its own background,
  // so the button goes light there, and its ink follows the BUTTON's luminance rather
  // than the ground's.
  const flood = shot.tone === 'flood';
  const btnBg = flood ? '#FFFFFF' : accent;
  const btnInk = flood ? '#0A0C0A' : '#FFFFFF';
  const e = entrance(local, 0, energy);

  return (
    <div style={{ ...FILL, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', opacity: e.opacity }}>
        <div
          style={{
            padding: '34px 74px',
            borderRadius: 20,
            background: btnBg,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), 0 ${20 - press * 12}px ${44 - press * 22}px rgba(0,0,0,0.55)`,
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 54,
            letterSpacing: '-0.02em',
            color: btnInk,
            transform: `scale(${1 - press * 0.045})`,
          }}
        >
          {shot.text}
        </div>

        {/* Ripple, on press only. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 20,
            border: `2px solid rgba(255,255,255,${0.5 * press})`,
            transform: `scale(${1 + press * 0.22})`,
            opacity: press,
          }}
        />

        <svg
          width="54"
          height="70"
          viewBox="0 0 24 30"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(${x}px, ${y}px) scale(${1 - press * 0.1})`,
            filter: 'drop-shadow(0 5px 9px rgba(0,0,0,0.6))',
          }}
        >
          <path
            d="M3 2 L3 22 L8.4 17.2 L11.8 25.4 L15.2 24 L11.8 15.9 L19 15.6 Z"
            fill="#fff"
            stroke="#111"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

/**
 * Artwork — the project's OWN hero image, presented as a lit panel in space.
 *
 * This is the only genuinely real picture in the whole film. Everything else is type on a
 * ground, which is the difference between a title sequence and a launch video: the
 * reference set is mostly product surfaces with type used as punctuation.
 *
 * Presented rather than pasted. A README banner dropped flat into a frame reads as a
 * screenshot in a slide deck; the same image given perspective, a contact shadow and a
 * slow push reads as an object that exists. The panel arrives slightly turned and settles
 * toward square, so the shot is a camera finding it rather than a picture appearing.
 */
export const Artwork: React.FC<UIShotProps> = ({ shot, accent, local, energy, frameWidth }) => {
  const t = tokensFor(shot.tone, accent);
  const src = shot.payload?.type === 'artwork' ? shot.payload.dataUri : null;
  const e = entrance(local, 4, energy);

  // Settle toward square, and keep pushing very slightly the whole time so the panel
  // never fully stops.
  const settle = interpolate(local, [0, 52], [1, 0.35], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (x) => 1 - Math.pow(1 - x, 3),
  });
  const drift = interpolate(local, [0, 120], [1, 1.045], { extrapolateRight: 'clamp' });

  if (!src) {
    // Plenty of repos have no artwork at all. Rather than render an empty frame, fall
    // back to the label alone, which at least still says something true.
    return (
      <div style={{ ...FILL, justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 120,
            letterSpacing: '-0.04em',
            color: t.fg,
            opacity: e.opacity,
          }}
        >
          {shot.text}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...FILL, justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          width: Math.min(frameWidth - GUTTER * 2, 1360),
          opacity: e.opacity,
          transform:
            'perspective(2200px) rotateY(' +
            (-7 * settle).toFixed(2) +
            'deg) rotateX(' +
            (4 * settle).toFixed(2) +
            'deg) scale(' +
            drift.toFixed(3) +
            ') translateY(' +
            e.y.toFixed(1) +
            'px)',
          transformOrigin: '50% 45%',
          borderRadius: 18,
          overflow: 'hidden',
          // Two-layer shadow: a wide ambient one and a tight contact one. The contact
          // shadow is what makes it sit ON something rather than float.
          boxShadow:
            shot.tone === 'paper'
              ? '0 54px 120px rgba(10,20,10,0.30), 0 14px 30px rgba(10,20,10,0.22)'
              : '0 54px 120px rgba(0,0,0,0.72), 0 14px 30px rgba(0,0,0,0.6)',
          border: '1px solid ' + (shot.tone === 'paper' ? 'rgba(10,20,10,0.12)' : 'rgba(255,255,255,0.12)'),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>

      <div
        style={{
          fontFamily: FONT.mono,
          fontSize: 20,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: t.pop(accent),
          marginTop: 34,
          opacity: entrance(local, 14, energy).opacity,
        }}
      >
        {shot.text}
      </div>
    </div>
  );
};
