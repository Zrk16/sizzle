import type { Shot } from '@/lib/spec';

/**
 * Tone tokens.
 *
 * `ink` and `paper` are not "dark mode / light mode" — they are a rhythm device. Cutting
 * between them swings mean frame luminance by ~160 in a single frame, which is what makes
 * an edit read as an edit. `flood` fills the frame with the project's accent and is the
 * loudest thing available, so it is rationed.
 *
 * Nothing here uses backdrop-filter, mix-blend-mode or z-index: @remotion/web-renderer
 * drops all three silently, which was measured, not assumed. Layering is DOM order,
 * back to front.
 */

export type Tone = Shot['tone'];

export type ToneTokens = {
  bg: string;
  fg: string;
  dim: string;
  rule: string;
  /** The accent, restated per tone — on a flood ground the accent IS the ground, so the
   *  highlight has to become the paper colour or it disappears into itself. */
  pop: (accent: string) => string;
};

export const TONES: Record<Tone, ToneTokens> = {
  ink: {
    bg: '#0A0A0C',
    fg: '#F4F3F0',
    dim: 'rgba(244,243,240,0.42)',
    rule: 'rgba(244,243,240,0.14)',
    pop: (accent) => accent,
  },
  paper: {
    bg: '#F4F3F0',
    fg: '#0A0A0C',
    dim: 'rgba(10,10,12,0.46)',
    rule: 'rgba(10,10,12,0.12)',
    pop: (accent) => accent,
  },
  flood: {
    bg: '#000000', // replaced with the accent at render time
    fg: '#FFFFFF',
    dim: 'rgba(255,255,255,0.62)',
    rule: 'rgba(255,255,255,0.24)',
    pop: () => '#FFFFFF',
  },
};

/** Flood grounds take the accent itself; the others are fixed. */
export function groundColour(tone: Tone, accent: string): string {
  return tone === 'flood' ? accent : TONES[tone].bg;
}

/**
 * Foreground for a flood ground has to be chosen against the accent, not assumed white.
 * A pale accent with white type on it is unreadable, and "it looked fine on my accent"
 * is exactly the bug that ships.
 */
export function readableOn(hex: string): '#0A0A0C' | '#FFFFFF' {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // Rec. 709 luma
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.55 ? '#0A0A0C' : '#FFFFFF';
}

export function tokensFor(tone: Tone, accent: string): ToneTokens & { bg: string; fg: string } {
  const base = TONES[tone];
  if (tone !== 'flood') return { ...base };
  const fg = readableOn(accent);
  return {
    ...base,
    bg: accent,
    fg,
    dim: fg === '#FFFFFF' ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,12,0.55)',
    rule: fg === '#FFFFFF' ? 'rgba(255,255,255,0.24)' : 'rgba(10,10,12,0.20)',
  };
}

/**
 * Type stack. Display and mono are deliberately far apart in weight and width —
 * principle 7 of the measured ad DNA is a big display statement against a tiny mono
 * caption, and that only works if the two faces disagree.
 *
 * TODO: ship real woff2 files. System stacks vary per machine, which means the render
 * is not deterministic across viewers. Tracked as its own task.
 */
export const FONT = {
  display:
    "'Neue Haas Grotesk Display', 'Helvetica Neue', Inter, -apple-system, 'Segoe UI', system-ui, sans-serif",
  mono: "'Berkeley Mono', 'JetBrains Mono', 'SF Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace",
} as const;

/** The logical canvas everything is authored against, then scaled to the real frame.
 *  One set of pixel values has to work at 16:9, 9:16 and 1:1. */
export const LOGICAL_HEIGHT = 1080;
