import type { RenderSpec } from './spec';

/**
 * The quality gate, ported from a python gate that scored rendered ads against numbers
 * measured from real reference films. It runs in the browser here, on frames sampled from
 * a low-resolution proxy render, so the visitor can watch their own video get graded.
 *
 * Every threshold below exists because a specific failure got shipped once:
 *
 *  - litCoverage: a version where every shot was a ~1000px island of UI centred on a
 *    near-black stage measured 6% of the frame above luminance 40. A whole-frame motion
 *    metric then scores 94% of every frame at exactly zero, which made the motion target
 *    arithmetically unreachable. Darker is NOT better; mean luminance is a ceiling, and
 *    the references sit around 98-117, not 18.
 *
 *  - cutStrength: butt-joined shots with a wipe between them sweep the incoming ground
 *    across black over three frames instead of one, and scene detection then finds ZERO
 *    cuts in the whole film. A real cut is one big luminance step.
 *
 *  - freezeRun: holding the camera dead still for the last third of every shot measured
 *    as "calm" on every average-based metric while reading as frozen. One dead second
 *    mid-shot is a stall. No single freeze should outlast about half a second.
 */

export type Frame = { lum: Float32Array; width: number; height: number };

export type Metric = {
  id: string;
  label: string;
  value: number;
  unit: string;
  ok: boolean;
  /** Plain-language note handed to the model when this metric fails. */
  fix: string;
};

export type Score = {
  metrics: Metric[];
  passed: number;
  total: number;
};

const mean = (xs: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += xs[i];
  return s / xs.length;
};

/** Rec. 709 luma from RGBA bytes, downsampled to one channel. */
export function toFrame(data: Uint8ClampedArray, width: number, height: number): Frame {
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lum[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return { lum, width, height };
}

function frameDelta(a: Frame, b: Frame): number {
  let sum = 0;
  for (let i = 0; i < a.lum.length; i++) sum += Math.abs(a.lum[i] - b.lum[i]);
  return sum / a.lum.length;
}

/**
 * @param frames  evenly sampled across the whole film
 * @param spec    used to locate shot boundaries, so cuts can be measured where they
 *                should be AND excluded from the motion figure — a cut is by design the
 *                largest delta in the film, and counting it made the hold phase of every
 *                shot measure as more active than its move phase.
 */
export function scoreFilm(frames: Frame[], spec: RenderSpec, sampleEvery: number): Score {
  const metrics: Metric[] = [];
  if (frames.length < 4) {
    return { metrics, passed: 0, total: 0 };
  }

  // ---- luminance: is the frame actually lit, and is it not blown out ----
  const frameMeans = frames.map((f) => mean(f.lum));
  const meanLum = mean(frameMeans);
  metrics.push({
    id: 'meanLum',
    label: 'Mean luminance',
    value: Math.round(meanLum),
    unit: '',
    ok: meanLum >= 45 && meanLum <= 150,
    fix:
      meanLum < 45
        ? 'The film is too dark overall. Use more paper or flood grounds — an all-ink cut reads as one long slide.'
        : 'The film is too bright overall. Introduce ink grounds so the light shots have something to cut against.',
  });

  // ---- coverage: what fraction of the frame carries light at all ----
  const coverage =
    mean(
      frames.map((f) => {
        let lit = 0;
        for (let i = 0; i < f.lum.length; i++) if (f.lum[i] > 40) lit++;
        return lit / f.lum.length;
      })
    ) * 100;
  metrics.push({
    id: 'coverage',
    label: 'Frame coverage',
    value: Math.round(coverage),
    unit: '%',
    ok: coverage >= 25,
    fix: 'Most of the frame is dead space with nothing in it. Favour paper and flood grounds, which fill the frame, over a dark ground with a small element on it.',
  });

  // ---- cuts: does each shot boundary actually register as a cut ----
  const boundaries = spec.shots.slice(1).map((s) => Math.floor(s.startFrame / sampleEvery));
  const cutDeltas = boundaries
    .filter((i) => i > 0 && i < frames.length)
    .map((i) => frameDelta(frames[i - 1], frames[i]));
  const weakCuts = cutDeltas.filter((d) => d < 18).length;
  metrics.push({
    id: 'cuts',
    label: 'Visible cuts',
    value: cutDeltas.length - weakCuts,
    unit: `/${cutDeltas.length}`,
    ok: cutDeltas.length > 0 && weakCuts === 0,
    fix: 'Some cuts are invisible because the shots on either side share a ground. Adjacent shots must use different tones — the tone change IS the cut.',
  });

  // ---- motion, with the cut frames excluded ----
  const cutSet = new Set(boundaries);
  const motionSamples: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    if (cutSet.has(i) || cutSet.has(i - 1) || cutSet.has(i + 1)) continue;
    motionSamples.push(frameDelta(frames[i - 1], frames[i]));
  }
  const motion = motionSamples.length ? mean(motionSamples) : 0;
  metrics.push({
    id: 'motion',
    label: 'Motion',
    value: Number(motion.toFixed(2)),
    unit: '',
    ok: motion >= 0.35,
    fix: 'Almost nothing moves between cuts. Shots need more on-screen elements arriving — prefer commitwall, code or stack over a single line of type.',
  });

  // ---- freeze: the longest run of near-identical frames ----
  let longest = 0;
  let run = 0;
  for (let i = 1; i < frames.length; i++) {
    if (frameDelta(frames[i - 1], frames[i]) < 0.05) run++;
    else run = 0;
    longest = Math.max(longest, run);
  }
  const freezeSeconds = (longest * sampleEvery) / spec.fps;
  metrics.push({
    id: 'freeze',
    label: 'Longest freeze',
    value: Number(freezeSeconds.toFixed(2)),
    unit: 's',
    ok: freezeSeconds <= 0.6,
    fix: 'The film stalls — a stretch of it is completely static. Shorten the shots so something is always arriving.',
  });

  return {
    metrics,
    passed: metrics.filter((m) => m.ok).length,
    total: metrics.length,
  };
}

/** The note handed back to the director when the gate fails. */
export function critiqueNotes(score: Score): string[] {
  return score.metrics.filter((m) => !m.ok).map((m) => `${m.label} = ${m.value}${m.unit}. ${m.fix}`);
}
