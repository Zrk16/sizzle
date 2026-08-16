import { interpolate, Easing } from 'remotion';

/**
 * Motion primitives. Every constant here was paid for by a bug.
 *
 * THE PIXEL GRID IS A HARD FLOOR ON CAMERA VELOCITY. Sub-pixel camera movement is not
 * slow motion — the renderer quantises it into a 1px lurch every N frames, which reads as
 * juddering. Measured displacement inside one shot once came out as `1 1 1 1 0 0 0 0 0 0…`
 * with 25 consecutive zero frames. Fixes that FAILED: move-then-stop (1.1s dead stall),
 * a 6%-amplitude creep (0.07px/frame, produced the lurch above), and a gentle bezier
 * ending at y=0.94 (moved the stall to the last three frames instead of removing it).
 *
 * What works: the camera runs LINEAR across the whole shot with enough amplitude to give
 * >= 1px/frame. Easing is for things that start and stop; a dolly runs at constant speed,
 * and the entrance spring already supplies the arrival feel.
 */

/** Linear camera travel across the full shot. Deliberately not eased. */
export function cameraOffset(local: number, duration: number, amplitude: number): number {
  return interpolate(local, [0, duration], [-amplitude / 2, amplitude / 2]);
}

/**
 * Entrance: snap in fast, resolve, then HOLD. Principle 8 of the measured ad DNA —
 * premium motion is not constant wiggle. The hold is what lets the eye read the frame.
 */
export function entrance(local: number, delay = 0, frames = 14) {
  const t = interpolate(local - delay, [0, frames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return { t, opacity: t, y: (1 - t) * 34 };
}

/** Per-item stagger for kinetic typography — words assemble, they do not all arrive. */
export function stagger(index: number, step = 3): number {
  return index * step;
}

/**
 * Exit: there isn't one, and that is on purpose.
 *
 * Animating both sides of a cut turned every join into a dark smear, and ffmpeg's scene
 * detection then found ZERO cuts in the whole film. A shot holds its composition to the
 * final frame and then simply stops existing.
 */
export const NO_EXIT = true;

/** Character reveal for `typeon`, with a caret that sits exactly after the last glyph. */
export function typedLength(local: number, total: number, cps = 26, fps = 30): number {
  return Math.min(total, Math.floor((local / fps) * cps));
}
