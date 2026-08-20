import type { RenderShot, Shot } from '@/lib/spec';

/**
 * How long a shot stays on screen.
 *
 * Every shot used to run exactly 66 frames because a constant said so, which meant the
 * claim — the one shot whose entire job is to be READ — got 2.2 seconds for a sentence
 * that takes about five. The film's only explanation was on screen too briefly to read.
 * Meanwhile a two-word lockup got the same 2.2 seconds and sat there dead.
 *
 * So duration is computed from content: acquire the frame, read what is on it, hold a
 * beat, then cut. Long copy earns time; short copy does not get handed it.
 */

/** Words per second for on-screen display type with no narration to carry it.
 *  Broadcast captions run 3+, but captions are read against speech that is already
 *  explaining. Silent display type needs more room, not less. */
const WPS = 2.6;

/** Seconds before reading starts: recognising the cut, finding where the text is. */
const ACQUIRE = 0.55;

/** Seconds held after the last word, so the cut does not feel yanked. */
const REST = 0.45;

/** Shots you SCAN rather than read: the eye samples a few lines and moves on. */
const SCANNED = new Set(['commitwall', 'code']);

/** Effort multiplies the hold, not the reading — reading time is a fact about the text. */
const EFFORT_REST: Record<string, number> = { fast: 0.6, balanced: 1, cinematic: 1.5 };

export type Pacing = { frames: number; readSeconds: number };

export function shotFrames(
  shot: Shot | RenderShot,
  fps: number,
  effort: string = 'balanced',
  payloadLines = 0
): Pacing {
  const words = shot.text.trim().split(/\s+/).filter(Boolean).length;
  const captionWords = shot.caption ? shot.caption.trim().split(/\s+/).filter(Boolean).length : 0;

  let readSeconds: number;
  if (SCANNED.has(shot.kind)) {
    // Nobody reads eight commit subjects. They read two or three and take in the shape of
    // the rest, so this scales far slower than a word count would suggest.
    readSeconds = (words + captionWords) / WPS + Math.min(payloadLines, 8) * 0.22;
  } else {
    readSeconds = (words + captionWords) / WPS;
  }

  const rest = REST * (EFFORT_REST[effort] ?? 1);
  const seconds = ACQUIRE + readSeconds + rest;

  /**
   * Floors and ceiling.
   *
   * The lockup gets a longer floor than everything else: it is the last thing on screen
   * and an ending that cuts as fast as a one-word beat reads as the film running out
   * rather than finishing. Without this the last three shots all landed on the 1.5s floor
   * back to back, which is a machine gun, not a rhythm.
   */
  const floor = shot.kind === 'lockup' ? 2.6 : 1.5;
  const frames = Math.round(Math.min(Math.max(seconds, floor), 6.0) * fps);
  return { frames, readSeconds };
}
