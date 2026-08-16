import { interpolate } from 'remotion';

/**
 * Motion language.
 *
 * Rebuilt against the house doctrine the /brag pipeline animates by, because the first
 * version broke two of its rules at once:
 *
 *   1. "One ease everywhere reads flat." Every entrance in every shot used the same
 *      cubic-out. A composition should draw on about three easing CHARACTERS across its
 *      beats, varied by energy within the smooth families — calm (sine, power1), standard
 *      (power3, the workhorse), punch (power4, expo).
 *
 *   2. "Smooth beats bouncy." Entrances default to power3.out or a critically damped
 *      spring. Overshoot — back, elastic, bounce — is a rare, explicitly playful register,
 *      never the house style. The wordmark drop was settling on elastic.out as its default.
 *
 * Everything here is a pure function of progress. That is non-negotiable in Remotion:
 * rendering seeks to frame N directly, so a stateful spring integrator would desync,
 * while a closed form cannot.
 */

/* ---------------------------------------------------------------- easings */

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Gentle. Secondary elements, captions, anything ambient. */
export const sineOut = (t: number) => Math.sin(clamp01(t) * (Math.PI / 2));

/** The workhorse. Standard entrances and settles. */
export const power3Out = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** Dramatic deceleration. Reserved for the beats that should land hard. */
export const power4Out = (t: number) => 1 - Math.pow(1 - clamp01(t), 4);

/** Premium snap. The loudest thing available; used once or twice in a film. */
export const expoOut = (t: number) => {
  const x = clamp01(t);
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
};

/** Acceleration. Exits, and objects genuinely falling under gravity. */
export const power3In = (t: number) => Math.pow(clamp01(t), 3);

/**
 * A damped spring's exact position curve, as a closed form.
 *
 * The "iOS feel" is a spring's velocity curve, not a bounce: fast launch into a long
 * asymptotic settle. Critically damped (z = 1) barely overshoots at all.
 *
 * @param response        seconds one oscillation would take
 * @param dampingFraction 1.0 critically damped (house default), 0.8 iOS register,
 *                        0.6-0.7 explicitly playful
 */
export function springEase(response = 0.5, dampingFraction = 1): (t: number) => number {
  const w = (2 * Math.PI) / response;
  const z = dampingFraction;

  let pos: (t: number) => number;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    pos = (t) => 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  } else if (z > 1) {
    const wo = w * Math.sqrt(z * z - 1);
    pos = (t) => 1 - Math.exp(-z * w * t) * (Math.cosh(wo * t) + ((z * w) / wo) * Math.sinh(wo * t));
  } else {
    pos = (t) => 1 - Math.exp(-w * t) * (1 + w * t);
  }

  // Settle time: the last moment the curve sits outside 0.1% of the target. Fixed-step
  // scan, run once at module load — deterministic, no clock and no randomness, both of
  // which would break a seeked render.
  const rate = z <= 1 ? z * w : (z - Math.sqrt(z * z - 1)) * w;
  const SCAN = 12 / rate;
  const N = 2400;
  let T = SCAN;
  for (let i = N; i >= 0; i--) {
    const t = (i / N) * SCAN;
    if (Math.abs(1 - pos(t)) > 0.001) {
      T = ((i + 1) / N) * SCAN;
      break;
    }
  }
  const xT = pos(T);
  // Normalised so ease(1) is exactly 1 — otherwise the last frame lands short of target.
  return (p: number) => {
    const x = clamp01(p);
    return pos(x * T) + x * (1 - xT);
  };
}

/** The house settle. Critically damped: smooth, no visible overshoot. */
export const settle = springEase(0.42, 1);

/* ------------------------------------------------------- energy per beat */

export type Energy = 'calm' | 'standard' | 'punch';

/**
 * Three characters across the film, assigned by what a shot is doing rather than at
 * random. A wall of eight commit lines wants to arrive gently or it reads as a slot
 * machine; a single word wider than the frame wants to land hard.
 */
export const ENERGY: Record<string, Energy> = {
  commitwall: 'calm',
  code: 'calm',
  stack: 'standard',
  bigtype: 'standard',
  typeon: 'standard',
  stat: 'punch',
  blowout: 'punch',
  lockup: 'punch',
};

const CURVE: Record<Energy, (t: number) => number> = {
  calm: sineOut,
  standard: power3Out,
  punch: expoOut,
};

/** Frames the entrance takes, by energy. Calm arrives slower; punch snaps. */
const FRAMES: Record<Energy, number> = { calm: 20, standard: 15, punch: 10 };

/** Travel distance, by energy. A punchier beat comes from further and faster. */
const RISE: Record<Energy, number> = { calm: 22, standard: 34, punch: 54 };

/**
 * Entrance: arrive, resolve, then HOLD. Premium motion is not constant wiggle — the hold
 * is what lets the eye actually read the frame.
 */
export function entrance(local: number, delay = 0, energy: Energy = 'standard') {
  const frames = FRAMES[energy];
  const t = interpolate(local - delay, [0, frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: CURVE[energy],
  });
  return { t, opacity: t, y: (1 - t) * RISE[energy] };
}

/** Per-item stagger. Words assemble; they do not all arrive at once. */
export function stagger(index: number, step = 3): number {
  return index * step;
}

/**
 * Camera: LINEAR across the whole shot.
 *
 * Easing is for things that start and stop; a dolly runs at constant speed and the
 * entrance already supplies the arrival feel. Move-then-hold produced a 1.1s dead stall,
 * and a low-amplitude "creep" is worse than nothing — sub-pixel velocity is not slow
 * motion, the renderer quantises it into a 1px lurch every N frames, which reads as
 * juddering. Amplitude must give at least 1px per frame.
 */
export function cameraOffset(local: number, duration: number, amplitude: number): number {
  return interpolate(local, [0, duration], [-amplitude / 2, amplitude / 2]);
}

/**
 * Exit: there isn't one, on purpose.
 *
 * Animating both sides of a cut turned every join into a dark smear, and ffmpeg's scene
 * detection then found ZERO cuts in the whole film. A shot holds its composition to the
 * final frame and then stops existing.
 */
export const NO_EXIT = true;

/** Character reveal for `typeon`, with a caret that sits after the last glyph. */
export function typedLength(local: number, total: number, cps = 26, fps = 30): number {
  return Math.min(total, Math.floor((local / fps) * cps));
}
