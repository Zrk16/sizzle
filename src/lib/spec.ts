import { z } from 'zod';

/**
 * The contract between the model and the renderer.
 *
 * Deliberately split in two. `aiSpec` is the ONLY thing the model is allowed to produce:
 * creative decisions — which shot, which tone, what words. Everything measurable —
 * timing, camera travel, easing, blur — is filled in by `toRenderSpec` from values that
 * were measured against real reference ads. A model having a bad day can write a weak
 * line; it cannot break the motion.
 *
 * The old CLI let the model emit {hook, tagline, stats[3], closer}, which forced every
 * video into a big-number-plus-small-label template — the exact shape the no-AI-look rule
 * bans. Shot kinds replace it.
 */

/** Browser-safe shot kinds only. Anything needing backdrop-filter, blend modes or
 *  3D perspective is excluded — @remotion/web-renderer drops those silently. */
export const SHOT_KINDS = [
  'bigtype', // oversized words, may exceed the frame
  'blowout', // one word wider than the canvas
  'typeon', // per-character reveal with a caret
  'commitwall', // the dev's real commit subjects, stacked and staggered
  'code', // real syntax-highlighted source from the repo
  'stat', // one number, used as punctuation and never as the hero
  'stack', // cards dropping in with overshoot
  'lockup', // name + line — the ending
] as const;

/** The ground a shot stands on. Adjacent shots MUST differ: cutting ink->paper swings
 *  mean frame luminance by ~160 in one frame, which is what makes a cut read as a cut. */
export const TONES = ['ink', 'paper', 'flood'] as const;

/**
 * Rejects the accents a model reaches for when it is not really choosing.
 *
 * Every corner of the RGB cube (#000000, #FF0000, #00FF00, #00FFFF, #FFFFFF …) is a value
 * that exists because of how bytes work, not because anyone looked at it. Near-black and
 * near-white fail for a different reason: the ground already carries the dark/light
 * contrast, so an accent at either extreme has no job to do.
 */
function isDefaultLookingColour(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));

  // Corner of the RGB cube — #FF0000, #00FF00, #FFFFFF and friends exist because of how
  // bytes work, not because anyone looked at them.
  if ([r, g, b].every((c) => c === 0 || c === 255)) return true;

  // Too dark or too pale to do the accent's job: the ground already carries that contrast.
  if (max < 0.18 || min > 0.86) return true;

  // NEON. This is the one that got through: #00FF66 is not a cube corner (blue is 102),
  // so an exact-value check passed it, and it rendered as a full-frame chroma-key green
  // with black type on it. Fully saturated at mid-to-high lightness is a screen colour,
  // not a brand colour — every accent that survived review sits under this line
  // (#FF4D00, #4D7F8F, #F54749 all measure saturation < 1 or lightness < 0.5).
  if (saturation > 0.92 && lightness > 0.42) return true;

  return false;
}

export const shotSchema = z.object({
  kind: z.enum(SHOT_KINDS),
  tone: z.enum(TONES),
  /**
   * On-screen copy. Long strings are the single most common way a generated video turns
   * ugly, so the ceiling is enforced here rather than hoped for in the prompt.
   *
   * For `code` and `commitwall` this is only a LABEL. The body of those shots is the
   * repo's real source and real commit subjects, injected by `toRenderSpec` from the
   * facts — asking a model to retype code it was shown is a pure downside: it paraphrases,
   * it truncates, and the one unfakeable thing on screen stops being true.
   */
  text: z.string().min(1).max(34),
  /** Optional second line, rendered small under `text` — the mono caption against the
   *  display statement. Scale contrast is principle 7 of the measured ad DNA. */
  caption: z.string().max(28).optional(),
});

export const aiSpecSchema = z
  .object({
    /** A question. Ziyaad's call: lead like an ad, not like a README. */
    hook: z.string().min(1).max(38),
    accent: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'accent must be a 6-digit hex colour')
      .refine((hex) => !isDefaultLookingColour(hex), {
        message:
          'that accent is a colour a computer picks, not a designer: avoid pure #00FF00 / #FF0000 style corner values, and anything near black or white. Pick something mixed, like #FF4D00 or #2E6F5E.',
      })
      .describe('One accent colour on a calm field — 2-3 colours max, never a rainbow.'),
    shots: z.array(shotSchema).min(4).max(7),
    closer: z.string().min(1).max(28),
  })
  .superRefine((spec, ctx) => {
    // Luminance rhythm: two identical grounds in a row read as one long slide.
    spec.shots.forEach((shot, i) => {
      if (i > 0 && shot.tone === spec.shots[i - 1].tone) {
        ctx.addIssue({
          code: 'custom',
          path: ['shots', i, 'tone'],
          message: `shot ${i} repeats tone "${shot.tone}" from the shot before it`,
        });
      }
    });
    // A wall of commit messages twice is a template, not a film.
    const kinds = spec.shots.map((s) => s.kind);
    for (const once of ['commitwall', 'code', 'lockup'] as const) {
      if (kinds.filter((k) => k === once).length > 1) {
        ctx.addIssue({ code: 'custom', path: ['shots'], message: `"${once}" may appear at most once` });
      }
    }
    if (kinds.at(-1) !== 'lockup') {
      ctx.addIssue({ code: 'custom', path: ['shots'], message: 'the last shot must be a lockup' });
    }
  });

export type AiSpec = z.infer<typeof aiSpecSchema>;
export type Shot = z.infer<typeof shotSchema>;

/**
 * Measured motion constants. These are NOT taste — they came out of measuring reference
 * ads frame by frame, and the notes behind each one cost real debugging time:
 *
 *  - camera runs LINEAR across the whole shot. Easing is for things that start and stop;
 *    a dolly runs at constant speed. Move-then-hold produced a 1.1s dead stall.
 *  - amplitude must give >= 1px/frame. Sub-pixel velocity is not slow motion — the
 *    renderer quantises it into a 1px lurch every N frames, which reads as juddering.
 *  - `cut` only. A wipe over butt-joined shots sweeps the incoming ground across black.
 */
export const MOTION = {
  fps: 30,
  shotFrames: { fast: 54, balanced: 66, cinematic: 78 },
  /** px of camera travel per shot, at the 1920-tall logical canvas */
  cameraTravel: 112,
  minPxPerFrame: 1,
} as const;

export type Effort = 'fast' | 'balanced' | 'cinematic';

/** Real repo content injected into shots that must not be paraphrased. */
export type ShotPayload =
  | { type: 'code'; path: string; lines: string[] }
  | { type: 'commits'; subjects: string[] };

export type RenderShot = Shot & {
  startFrame: number;
  durationInFrames: number;
  cameraDy: number;
  payload?: ShotPayload;
};

export type RenderSpec = {
  hook: string;
  accent: string;
  closer: string;
  /** Shown in the frame chrome, so every shot is labelled with what it is about. */
  repo: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  shots: RenderShot[];
};

/** The subset of repo facts the renderer needs. Kept structural so `spec.ts` does not
 *  have to import the analyzer and drag GitHub types into the browser bundle. */
export type SpecFacts = {
  repo: string;
  recentCommits: string[];
  codeSample: { path: string; lines: string[] } | null;
};

/**
 * Turn the model's creative choices into a fully specified render. Every number below
 * is derived here, never asked for — that is the whole point of the split.
 */
export function toRenderSpec(
  ai: AiSpec,
  facts: SpecFacts,
  effort: Effort = 'balanced',
  aspect: '16:9' | '9:16' | '1:1' = '16:9'
): RenderSpec {
  const per = MOTION.shotFrames[effort];
  const [width, height] =
    aspect === '9:16' ? [1080, 1920] : aspect === '1:1' ? [1080, 1080] : [1920, 1080];

  let cursor = 0;
  const shots: RenderShot[] = ai.shots.map((shot, i) => {
    // A wall of one commit is not a wall; a code shot showing a file path is not code.
    // Both bodies come from the repo, never from the model.
    let payload: ShotPayload | undefined;
    if (shot.kind === 'commitwall' && facts.recentCommits.length) {
      payload = { type: 'commits', subjects: facts.recentCommits.slice(0, 8) };
    } else if (shot.kind === 'code' && facts.codeSample) {
      payload = { type: 'code', path: facts.codeSample.path, lines: facts.codeSample.lines };
    }

    const durationInFrames = per;
    const startFrame = cursor;
    cursor += durationInFrames;
    // Alternate travel direction so consecutive shots do not feel like one long drift.
    const magnitude = Math.max(MOTION.cameraTravel, durationInFrames * MOTION.minPxPerFrame);
    return {
      ...shot,
      startFrame,
      durationInFrames,
      cameraDy: i % 2 === 0 ? magnitude : -magnitude,
      payload,
    };
  });

  return {
    hook: ai.hook,
    accent: ai.accent,
    closer: ai.closer,
    repo: facts.repo,
    fps: MOTION.fps,
    width,
    height,
    durationInFrames: cursor,
    shots,
  };
}

/** JSON Schema handed to Gemini. Kept in lockstep with `aiSpecSchema` above —
 *  the model is constrained here, and zod re-checks the result server-side. */
export const geminiResponseSchema = {
  type: 'object',
  properties: {
    hook: { type: 'string', description: 'A question that makes a developer curious. HARD LIMIT 38 characters.' },
    accent: { type: 'string', description: 'One accent colour as 6-digit hex, e.g. #E8552D. Must suit the project.' },
    shots: {
      type: 'array',
      minItems: 4,
      maxItems: 7,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...SHOT_KINDS] },
          tone: { type: 'string', enum: [...TONES] },
          text: { type: 'string', description: 'On-screen copy. HARD LIMIT 34 characters.' },
          caption: { type: 'string', description: 'Optional small line under the text. HARD LIMIT 28 characters.' },
        },
        required: ['kind', 'tone', 'text'],
      },
    },
    closer: { type: 'string', description: 'Final line. HARD LIMIT 28 characters.' },
  },
  required: ['hook', 'accent', 'shots', 'closer'],
} as const;
