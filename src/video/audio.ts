import type { RenderSpec } from '@/lib/spec';

/**
 * The score, generated from the spec.
 *
 * The film was silent, and a silent cut reads as a slideshow no matter how well eased —
 * /brag's whole brief is half audio, with reveals landing on beats and effects matched to
 * motion. This is the missing half.
 *
 * It is SYNTHESISED rather than sourced, for one decisive reason: the hits are computed
 * from the shot boundaries, so a cut can never drift out of sync with its sound. A music
 * bed licensed from anywhere has a fixed tempo, and the film's shot lengths come from how
 * long its text takes to read — those two do not agree, and forcing them means either
 * cutting on the wrong frame or reading half a sentence. Generating the audio from the
 * edit makes sync structural instead of a thing to nudge.
 *
 * Everything below is a pure function of the spec: same spec, same bytes, every time.
 * Remotion renders by seeking, so anything time-dependent or random would desync.
 */

const SAMPLE_RATE = 22_050; // mono, speech-band; a bed and some hits need nothing more
const BYTES_PER_SAMPLE = 2;

/** Musical intervals from the root, as frequency ratios. Just intonation, so the bed
 *  beats slowly rather than sitting perfectly still. */
const FIFTH = 3 / 2;
const OCTAVE = 2;

/** Root of the drone, in Hz. Low enough to sit under type without competing with it. */
const ROOT = 55; // A1

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Deterministic value noise. `Math.random` cannot appear anywhere near a seeked render —
 * two renders of the same frame would differ — so this is a hash of the sample index.
 */
function noise(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/** One percussive hit: a short filtered-noise transient over a pitched body. */
function hit(t: number, i: number, strength: number): number {
  if (t < 0) return 0;
  const transient = Math.exp(-t * 46) * noise(i) * 0.5;
  const body = Math.exp(-t * 12) * Math.sin(2 * Math.PI * (ROOT * OCTAVE) * t);
  return (transient + body * 0.7) * strength;
}

/** A soft riser leading into a cut, so the edit is anticipated rather than just arriving. */
function riser(t: number, length: number): number {
  if (t < 0 || t > length) return 0;
  const p = t / length;
  const sweep = 180 + p * p * 900;
  return Math.sin(2 * Math.PI * sweep * t) * p * p * 0.055;
}

export type Score = { dataUri: string; seconds: number; hits: number };

/**
 * Render the whole score to a WAV data URI.
 *
 * A data URI rather than a file because the score is different for every repo — it is
 * derived from that film's own cut points — so there is nothing to host. At 22.05kHz mono
 * a twenty-second score is about 440KB of PCM, which is acceptable inline and far smaller
 * than any real track would be.
 */
export function buildScore(spec: RenderSpec): Score {
  const seconds = spec.durationInFrames / spec.fps;
  const total = Math.ceil(seconds * SAMPLE_RATE);
  const pcm = new Int16Array(total);

  // Cut points, in seconds. The first shot is not a cut — nothing precedes it.
  const cuts = spec.shots.slice(1).map((s) => s.startFrame / spec.fps);

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    let v = 0;

    // --- the bed: two detuned drones a fifth apart, breathing slowly
    const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.08 * t);
    v += Math.sin(2 * Math.PI * ROOT * t) * 0.16 * (0.7 + 0.3 * breath);
    v += Math.sin(2 * Math.PI * ROOT * FIFTH * t) * 0.09 * breath;
    // A little air on top so it is not purely sub-bass on small speakers.
    v += Math.sin(2 * Math.PI * ROOT * OCTAVE * OCTAVE * t) * 0.02 * breath;

    // --- hits on the cuts, with a riser into each
    for (let c = 0; c < cuts.length; c++) {
      const dt = t - cuts[c];
      if (dt > -0.45 && dt < 1.2) {
        // Alternate strength so a run of cuts has a rhythm rather than a metronome.
        v += hit(dt, i, c % 2 === 0 ? 0.42 : 0.3);
        v += riser(dt + 0.45, 0.45);
      }
    }

    // --- fades, so the file never clicks at either end
    const fadeIn = clamp(t / 0.6, 0, 1);
    const fadeOut = clamp((seconds - t) / 1.1, 0, 1);
    v *= fadeIn * fadeOut;

    // Soft clip rather than hard limit: a tanh curve keeps transients from crackling.
    pcm[i] = Math.round(clamp(Math.tanh(v * 1.2), -1, 1) * 32767 * 0.9);
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
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * BYTES_PER_SAMPLE, true); // byte rate
  view.setUint16(32, BYTES_PER_SAMPLE, true); // block align
  view.setUint16(34, 8 * BYTES_PER_SAMPLE, true); // bits per sample
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
