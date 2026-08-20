import type { RenderSpec } from '@/lib/spec';

/**
 * The score, generated from the spec.
 *
 * SECOND VERSION. The first was two sine drones a fifth apart with a pitched transient on
 * each cut, and it was described exactly right on review: "a whistle, then a plop at every
 * scene, no background". Both faults are the same mistake — using OSCILLATORS where film
 * sound uses TEXTURE.
 *
 *   A sustained pure tone is a test signal. Ears hear a sine at 55Hz plus its fifth as a
 *   whistle because nothing in a room ever sounds like that; real atmosphere is broadband
 *   noise shaped by a filter, which is why it sits under a picture instead of on top of it.
 *
 *   A hit with a strong pitched body is a plop, because the pitch makes it a NOTE and a
 *   note in a bed with no key sounds wrong wherever you put it. Impacts in a mix are
 *   mostly filtered noise plus a very low, very fast thump you feel more than hear.
 *
 * So the bed is now brown noise through a one-pole lowpass with a slow filter sweep — room
 * tone, essentially — over a sub too low to carry pitch. The hits are a lowpassed noise
 * burst plus a 52Hz thump, with the pitched component gone.
 *
 * Everything is a pure function of the spec: same spec, same bytes. Remotion renders by
 * seeking, so a clock or Math.random anywhere here would desync a frame.
 */

const SAMPLE_RATE = 22_050;
const BYTES_PER_SAMPLE = 2;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Deterministic white noise. A hash of the sample index, not a PRNG with state — a seeked
 * render must be able to produce sample N without having produced N-1.
 */
function white(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

export type Score = { dataUri: string; seconds: number; hits: number };

export function buildScore(spec: RenderSpec): Score {
  const seconds = spec.durationInFrames / spec.fps;
  const total = Math.ceil(seconds * SAMPLE_RATE);
  const pcm = new Int16Array(total);

  // Cut points in seconds. The first shot is not a cut; nothing precedes it.
  const cuts = spec.shots.slice(1).map((s) => s.startFrame / spec.fps);

  // --- filter state. These integrate across samples, which is fine: the whole buffer is
  // built in one pass from sample 0, so the result is still identical every run.
  let brown = 0; // running integral of white noise
  let lp1 = 0; // bed lowpass stages
  let lp2 = 0;
  let hitLp = 0; // separate lowpass for impacts

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;

    // ---------------------------------------------------------------- bed
    // Brown noise: integrate white and leak, so it drifts without running away.
    brown = brown * 0.996 + white(i) * 0.055;

    // Two-pole lowpass with a slow sweep. The sweep is what stops it sounding like static
    // — the timbre moves, the way air in a room does.
    const sweep = 0.055 + 0.03 * Math.sin(2 * Math.PI * 0.045 * t);
    lp1 += sweep * (brown - lp1);
    lp2 += sweep * (lp1 - lp2);

    /**
     * Gain staging, set by measurement rather than by ear.
     *
     * The first pass at this ran the bed at RMS ~18500 of 32767 — about -5dBFS, which is
     * mastering level for a whole mix, not for something meant to sit UNDER a picture.
     * Hits then measured only 1.45x above it, so nothing landed. A bed belongs around
     * -20dBFS with impacts several times above.
     */
    let v = lp2 * 0.62;

    // A little air, so the bed is not purely rumble. Brown noise falls off at 6dB/octave,
    // which leaves nothing at all above a few hundred Hz — and a bed with no top reads as
    // a rumble rather than as a room.
    v += (white(i * 2 + 1) - white(i * 2)) * 0.012;

    // A sub for weight. At 34Hz this is below where pitch is really heard — it reads as
    // size, not as a note, which is the difference between a bed and a drone.
    v += Math.sin(2 * Math.PI * 34 * t) * 0.028 * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.07 * t));

    // ---------------------------------------------------------------- hits
    for (let c = 0; c < cuts.length; c++) {
      const dt = t - cuts[c];
      if (dt < -0.0001 || dt > 0.9) continue;

      // Impact: a burst of noise, lowpassed hard so it is a thud rather than a tick.
      const burst = white(i + c * 7919) * Math.exp(-dt * 30);
      hitLp += 0.16 * (burst - hitLp);

      // Thump: very low, very fast. Felt more than heard.
      const thump = Math.sin(2 * Math.PI * 52 * dt) * Math.exp(-dt * 17);

      // Alternate weight so a run of cuts has a rhythm rather than a metronome.
      const strength = c % 2 === 0 ? 1 : 0.78;
      v += (hitLp * 3.6 + thump * 0.5) * strength;

      // A short swell of bed level INTO the next cut, so the edit is anticipated.
      if (dt > 0.02) v *= 1 + Math.exp(-dt * 4) * 0.12;
    }

    // ---------------------------------------------------------------- shape
    const fadeIn = clamp(t / 0.8, 0, 1);
    const fadeOut = clamp((seconds - t) / 1.3, 0, 1);
    v *= fadeIn * fadeOut;

    // Soft clip. tanh keeps transients from crackling where a hard limit would.
    pcm[i] = Math.round(clamp(Math.tanh(v * 1.15), -1, 1) * 32767 * 0.82);
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
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * BYTES_PER_SAMPLE, true);
  view.setUint16(32, BYTES_PER_SAMPLE, true);
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true);
  ascii(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000; // apply() blows the stack on very large arrays
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  const base64 =
    typeof btoa === 'function' ? btoa(binary) : Buffer.from(buffer).toString('base64');
  return `data:audio/wav;base64,${base64}`;
}
