/**
 * Event density, transition variety, and per-film variation.
 *
 * Measured against the reference launch film, three gaps explain why every sizzle film
 * feels like the same film:
 *
 *   transitions       22 in 40.9s        vs  6 in 23.4s
 *   one every         1.86s              vs  3.90s
 *   instant/gradual   11 / 11            vs  5 / 1
 *   baseline motion   1.40 median delta  vs  0.71
 *
 * The event rate is the headline. Something changes on that film roughly every two
 * seconds; here, the only thing that ever changes is the shot boundary itself, so a 3.5s
 * shot is 3.5 seconds of one held picture. Half its transitions are also GRADUAL, where
 * effectively all of ours are hard cuts, so every change we make reads identical.
 *
 * The reference beat sheets show where the extra events come from: a single 4.9s scene
 * there has six images arriving, then five text labels landing at 875/1846/2528/3162ms.
 * A shot is not one composition — it is a composition plus its own internal beats.
 *
 * Everything here is a pure function of (seed, index, local frame). Remotion seeks to
 * frame N directly, so anything stateful or random desyncs between the player and the
 * render; a hash of the repo name gives per-film variation that is still deterministic.
 */

/** FNV-1a. Small, stable, and dependency-free — the same repo always gets the same film. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic small integer for slot `index` of a film. */
export function variant(seed: number, index: number, choices: number): number {
  // Mix the index in rather than stepping through, so adjacent shots don't get adjacent
  // treatments — consecutive shots sharing a treatment is exactly the sameness being fixed.
  const mixed = Math.imul(seed ^ Math.imul(index + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return mixed % choices;
}

/**
 * Arrival treatments. One per film-slot, so two repos do not move identically and two
 * neighbouring shots inside one film do not either.
 *
 * These stay inside the measured entrance ranges — sibling arrivals 150-500ms apart
 * (median ~300ms, so 9 frames at 30fps), per-word ~80ms, per-character ~30ms. What varies
 * is the SHAPE of the arrival, not whether it obeys the rules.
 */
export type Treatment = {
  name: string;
  /** Frames between sibling arrivals. 30fps: 4 ≈ 133ms, 9 ≈ 300ms, 14 ≈ 466ms. */
  stagger: number;
  /** Order siblings arrive in. 'edge' starts at both ends and meets in the middle. */
  order: 'forward' | 'reverse' | 'edge';
  /** Extra delay before the block starts, in frames. Reference films leave the first
   *  100-200ms of a shot quiet; this varies where inside that window it lands. */
  lead: number;
};

export const TREATMENTS: Treatment[] = [
  { name: 'cascade', stagger: 9, order: 'forward', lead: 3 },
  { name: 'quick', stagger: 4, order: 'forward', lead: 5 },
  { name: 'unfurl', stagger: 14, order: 'reverse', lead: 2 },
  { name: 'meet', stagger: 7, order: 'edge', lead: 4 },
];

export function treatmentFor(seed: number, index: number): Treatment {
  return TREATMENTS[variant(seed, index, TREATMENTS.length)];
}

/** Sibling delay under a treatment, given the item's position in a list of `count`. */
export function siblingDelay(t: Treatment, i: number, count: number): number {
  const slot =
    t.order === 'forward'
      ? i
      : t.order === 'reverse'
        ? count - 1 - i
        : // 'edge': outermost first, meeting in the middle
          Math.min(i, count - 1 - i);
  return t.lead + slot * t.stagger;
}

/**
 * The mid-shot beat.
 *
 * A held composition scores zero motion for its whole hold, and reads as a slide. This is
 * a second event placed inside the shot — late enough that the entrance has fully settled
 * and been read, early enough to still be on screen for a moment afterwards.
 *
 * Returns 0 before the beat and ramps to 1 across `frames`. The reference set puts its
 * internal events around the 55-70% mark of a scene, which is also where a viewer's
 * attention starts to drop.
 */
export function midBeat(local: number, duration: number, frames = 12): number {
  if (duration <= 0) return 0;
  const at = duration * 0.58;
  const t = (local - at) / frames;
  return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
}

/**
 * Gradual incoming transition.
 *
 * Half the reference film's changes are gradual; effectively all of ours are hard cuts, so
 * every boundary lands the same way. This fades the incoming shot up over a few frames
 * WITHOUT touching startFrame — which matters, because the score's impacts are aligned to
 * those exact frames and a TransitionSeries would shift every one of them.
 *
 * Applied only where a cut would be harshest: a tone change. Ink to paper is a near-full
 * luminance inversion, and butt-joining those two produced the single largest frame delta
 * in the film — a bigger jump than anything in the reference.
 */
export function crossIn(local: number, frames: number): number {
  if (frames <= 0) return 1;
  const t = local / frames;
  return t >= 1 ? 1 : t <= 0 ? 0 : t;
}
