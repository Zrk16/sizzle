/**
 * Type fitting.
 *
 * The old shots set font size as a CONSTANT — bigtype at 208px, blowout at 560px — while
 * the schema allowed up to 34 characters. Thirty-four characters at 208px is roughly
 * 3,500px of text on a 1920px canvas, so overflow was not a risk, it was the default for
 * any string past about eighteen characters. Nothing anywhere measured whether text fit.
 *
 * Fixed by deriving the size from the string instead of asserting it: pick the largest
 * size at which the text still wraps inside its box, then use it. Overflow stops being
 * possible rather than becoming less likely.
 *
 * Widths are estimated from average advance width rather than measured with a canvas,
 * deliberately — this has to produce the identical answer on the server, in the browser
 * renderer and inside a seeked frame, and a canvas measurement depends on which fonts
 * happen to have loaded. An estimate that is always the same beats a measurement that
 * sometimes is not. The ratios below are conservative, so the estimate errs toward
 * predicting text WIDER than it renders, which fails safe.
 */

/** Average advance width as a fraction of font size, by face. */
const ADVANCE = {
  /** Bricolage/grotesk at heavy weight, mixed case. */
  display: 0.55,
  /** Geist Mono is monospaced: every glyph is exactly this wide. */
  mono: 0.6,
} as const;

export type Face = keyof typeof ADVANCE;

export type Fitted = {
  fontSize: number;
  lines: string[];
  /** Widest line, in px, at the chosen size. */
  width: number;
  height: number;
};

/** Greedy word wrap at a given size. Returns null if any single word cannot fit. */
function wrapAt(
  text: string,
  fontSize: number,
  maxWidth: number,
  face: Face
): string[] | null {
  const per = fontSize * ADVANCE[face];
  const max = Math.floor(maxWidth / per);
  if (max < 1) return null;

  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    // A single word longer than the line can never be wrapped — the caller must shrink.
    if (word.length > max) return null;
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= max) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Largest size at which `text` fits inside the box within `maxLines`.
 *
 * Walks down from the ideal size rather than solving directly, because wrapping is
 * discrete: the line count steps down at specific sizes, and the largest fitting size is
 * usually just below one of those steps.
 */
export function fitText(
  text: string,
  {
    boxWidth,
    boxHeight = Infinity,
    maxLines = 3,
    ideal,
    min = 24,
    lineHeight = 1.05,
    face = 'display' as Face,
  }: {
    boxWidth: number;
    boxHeight?: number;
    maxLines?: number;
    ideal: number;
    min?: number;
    lineHeight?: number;
    face?: Face;
  }
): Fitted {
  const clean = text.trim().replace(/\s+/g, ' ');

  for (let size = Math.round(ideal); size >= min; size -= 2) {
    const lines = wrapAt(clean, size, boxWidth, face);
    if (!lines || lines.length > maxLines) continue;
    const height = lines.length * size * lineHeight;
    if (height > boxHeight) continue;
    const width = Math.max(...lines.map((l) => l.length)) * size * ADVANCE[face];
    return { fontSize: size, lines, width, height };
  }

  // Nothing fit even at the floor. Return the floor with a hard wrap rather than throwing:
  // a slightly-too-small shot is recoverable, a crashed render is not.
  const lines = wrapAt(clean, min, boxWidth, face) ?? [clean];
  return {
    fontSize: min,
    lines: lines.slice(0, maxLines),
    width: boxWidth,
    height: Math.min(lines.length, maxLines) * min * lineHeight,
  };
}

/** True if the text would overflow at this exact size. Used by the gate. */
export function overflowsAt(
  text: string,
  fontSize: number,
  boxWidth: number,
  maxLines: number,
  face: Face = 'display'
): boolean {
  const lines = wrapAt(text.trim().replace(/\s+/g, ' '), fontSize, boxWidth, face);
  return lines === null || lines.length > maxLines;
}
