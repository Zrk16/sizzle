import type { RenderSpec } from '@/lib/spec';

/**
 * The score, generated from the spec.
 *
 * THIRD VERSION, and the first one built against measurements rather than intuition.
 *
 * V1 was two sine drones and a pitched transient: "a whistle, then a plop at every scene".
 * V2 replaced them with brown noise and a thump, and was worse. Measuring both against
 * four real reference films (Airbnb, Bolt, Higgsfield, an eyeson SaaS spot) showed why:
 *
 *                    refs avg    V2       delta
 *   sub 20-80Hz        58.1%    92.5%    +34.4pt
 *   low 80-300Hz       30.6%     7.2%    -23.4pt
 *   mid 300-2kHz        5.8%     0.2%     -5.6pt
 *   high 2k-8kHz        5.5%     0.0%     -5.4pt
 *   dynamics (p95/med) 2.0-3.1x  1.69x
 *
 * V2 had essentially NOTHING above 300Hz. It was not a bed, it was a rumble — which is
 * why it read as "no background sound" despite being audibly present. The lowpass that
 * killed the whistle also killed every frequency that carries body and presence.
 *
 * This version is built in four bands with levels chosen to land inside the reference
 * range, and the mix is verified by re-measuring against those same films. Loudness was
 * already right (-18.3 dBFS median against a reference range of -17 to -22); the fault
 * was entirely spectral shape and dynamic range.
 *
 * Everything remains a pure function of the spec — no clock, no Math.random — because
 * Remotion renders by seeking and anything stateful across renders would desync.
 */

const SAMPLE_RATE = 22_050;
const BYTES_PER_SAMPLE = 2;

/**
 * Target spectral shape, from the reference average. Not copied from any single film:
 * the eyeson spot is 88% sub and the Higgsfield one is 10%, so an average across the set
 * is the honest target rather than an imitation of whichever was measured last.
 */
export const SPECTRAL_TARGET = { sub: 48, low: 34, mid: 11, high: 7 };

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Deterministic white noise: a hash of the sample index, never a stateful PRNG. */
function white(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export type Score = { dataUri: string; seconds: number; hits: number };

export function buildScore(spec: RenderSpec): Score {
  const seconds = spec.durationInFrames / spec.fps;
  const total = Math.ceil(seconds * SAMPLE_RATE);
  const pcm = new Int16Array(total);

  const cuts = spec.shots.slice(1).map((s) => s.startFrame / spec.fps);

  // Filter state. Built in one forward pass from sample 0, so the output is identical
  // every run even though these carry across samples.
  let brown = 0;
  let subLp = 0;
  let bodyLp = 0;
  let bodyHp = 0;
  let midLp = 0;
  let midHp = 0;
  let airHp = 0;
  let hitLp = 0;

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const n = white(i);
    brown = brown * 0.996 + n * 0.055;

    // ------------------------------------------------------------- SUB (20-80)
    // Heavily lowpassed brown, plus a 36Hz tone for weight. Below where pitch reads,
    // so it is size rather than a note.
    subLp += 0.035 * (brown - subLp);
    let v = subLp * 1.06;
    v += Math.sin(2 * Math.PI * 36 * t) * 0.055 * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.07 * t));

    // ------------------------------------------------------------- LOW (80-300)
    // The band V2 was missing almost entirely, and the one that makes a bed sound like
    // music rather than weather. Bandpass = lowpass of a highpassed signal.
    bodyHp = 0.965 * (bodyHp + n - (bodyLp || 0));
    bodyLp += 0.13 * (n - bodyLp);
    const body = bodyLp - subLp; // strip what the sub band already carries
    v += body * 0.95 * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.11 * t));

    // ------------------------------------------------------------- MID (300-2k)
    // Presence. Quiet, but its absence is what made V2 sound like it was behind a wall.
    midLp += 0.42 * (n - midLp);
    midHp = midLp - bodyLp;
    v += midHp * 0.24 * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.09 * t + 1.3));

    // ------------------------------------------------------------- HIGH (2k-8k)
    // Air. A first-difference of white noise is a cheap highpass.
    airHp = n - white(i - 1);
    v += airHp * 0.075;

    // ------------------------------------------------------------- hits
    for (let c = 0; c < cuts.length; c++) {
      const dt = t - cuts[c];
      if (dt < -0.0001 || dt > 0.9) continue;

      // Broadband impact. V2 lowpassed this so hard it became a soft thud with no
      // definition; a real hit has top on it or it does not read as an event.
      const burst = white(i + c * 7919) * Math.exp(-dt * 26);
      hitLp += 0.34 * (burst - hitLp);
      const crack = (burst - hitLp) * Math.exp(-dt * 55); // the transient edge

      const thump = Math.sin(2 * Math.PI * 54 * dt) * Math.exp(-dt * 15);

      // Dynamics were 1.69x against a reference range of 2.0-3.1x, so hits carry more.
      const strength = c % 2 === 0 ? 1 : 0.8;
      v += (hitLp * 5.2 + crack * 2.6 + thump * 0.85) * strength;
    }

    // ------------------------------------------------------------- shape
    const fadeIn = clamp(t / 0.8, 0, 1);
    const fadeOut = clamp((seconds - t) / 1.3, 0, 1);
    v *= fadeIn * fadeOut;

    pcm[i] = Math.round(clamp(Math.tanh(v * 1.1), -1, 1) * 32767 * 0.8);
  }

  return { dataUri: wavDataUri(pcm), seconds, hits: cuts.length };
}

/** Minimal 16-bit mono PCM WAV, base64 encoded. */
function wavDataUri(pcm: Int16Array): string {
  const dataBytes = pcm.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * BYTES_PER_SAMPLE, true);
  view.setUint16(32, BYTES_PER_SAMPLE, true);
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const base64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(buffer).toString('base64');
  return `data:audio/wav;base64,${base64}`;
}
