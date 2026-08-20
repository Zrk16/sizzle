import { z } from 'zod';
import { shotFrames } from '@/video/pacing';

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
/**
 * Five kinds, down from eight.
 *
 * `blowout` set one word at 560px and was the single worst overflow offender; `typeon`
 * was a gimmick that read as a terminal demo whatever the project; `stack` split its text
 * on commas and collapsed to a single card whenever there weren't any. Most of what reads
 * as AI is variety executed badly — a film with five deliberate kinds beats one with
 * eight guessed ones.
 */
export const SHOT_KINDS = [
  'claim', // the one shot allowed a full sentence: what this project actually IS
  'bigtype', // oversized words, the display statement
  'commitwall', // the dev's real commit subjects, stacked and staggered
  'code', // real source from the repo
  'stat', // one number, punctuation and never the hero
  'bento', // glass cards on a tilting plane — what the project is made of
  'pointer', // a real cursor travelling to a button and pressing it
  'artwork', // the project's OWN hero image from its README, as a lit panel
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
  text: z.string().min(1).max(96),
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
          // Deliberately NO example hex here. An earlier version suggested two, and the
          // model returned one of them verbatim as its "choice" — the same failure as
          // putting <angle-bracket> placeholders in a prompt. Describe the target, never
          // hand over a value that can be copied.
          'that accent is a colour a computer picks, not a designer. Avoid the corners of the RGB cube, anything near black or white, and any fully saturated screen colour. Choose a mixed, slightly muted hue that suits this specific project.',
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
    /**
     * At least a third of the film stands on INK.
     *
     * Measured against the reference set: they run mean luminance 46-121 with a darkest-5%
     * of 0-4. This film measured 125 luminance and 14 darkest-5% — brighter than every
     * reference and with no true black anywhere in it. Real blacks are the single
     * strongest "expensive" tell in that set, and a film that never goes dark has no
     * depth anchor to contrast against.
     *
     * Alternating tones alone does not guarantee this: paper/flood/paper/flood satisfies
     * every existing rule and never once goes dark.
     */
    const inkCount = spec.shots.filter((sh) => sh.tone === 'ink').length;
    if (inkCount < Math.ceil(spec.shots.length / 3)) {
      ctx.addIssue({
        code: 'custom',
        path: ['shots'],
        message: `only ${inkCount} of ${spec.shots.length} shots stand on ink. At least a third must, or the film has no true blacks in it and reads washed out.`,
      });
    }

    /**
     * Artwork always stands on INK.
     *
     * The first artwork shot rendered a red project banner on a red-orange flood ground:
     * the picture and the ground were the same hue and fought each other. A real image is
     * the brightest, most detailed thing in any frame it appears in, so it should be the
     * only lit object — one light source in darkness is the cheapest cinematic move there
     * is, and it is what the reference films do with product shots.
     */
    spec.shots.forEach((sh, i) => {
      if (sh.kind === 'artwork' && sh.tone !== 'ink') {
        ctx.addIssue({
          code: 'custom',
          path: ['shots', i, 'tone'],
          message:
            'an "artwork" shot must stand on ink. The image is the brightest thing in the frame, so the ground has to be dark or the two compete.',
        });
      }
    });

    if (kinds.at(-1) !== 'lockup') {
      ctx.addIssue({ code: 'custom', path: ['shots'], message: 'the last shot must be a lockup' });
    }

    // EXACTLY ONE claim. Without it the film is a mood reel: a question, some texture,
    // and a name, with nothing anywhere that says what the project does. With more than
    // one it stops being a film and becomes a paragraph read aloud.
    const claims = kinds.filter((k) => k === 'claim').length;
    if (claims !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['shots'],
        message:
          claims === 0
            ? 'there is no "claim" shot, so the film never says what this project actually does. Add exactly one, early, in a full plain sentence.'
            : 'only one "claim" shot is allowed; the rest of the film is proof, not explanation.',
      });
    }
    // The claim has to land before the proof, or the viewer is looking at evidence for
    // something they have not been told yet.
    const claimAt = kinds.indexOf('claim');
    if (claimAt > 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['shots', claimAt],
        message: 'the claim comes too late: it must be one of the first three shots.',
      });
    }

    // Per-kind length. A claim needs room for a sentence; everything else is a beat.
    // These are still enforced even though the renderer now auto-fits type: fitting stops
    // a long string from overflowing, it does not stop it from shrinking to 24px and
    // reading as a paragraph in a shot that wanted three words.
    spec.shots.forEach((shot, i) => {
      const cap = shot.kind === 'claim' ? 96 : 34;
      if (shot.text.length > cap) {
        ctx.addIssue({
          code: 'custom',
          path: ['shots', i, 'text'],
          message: `"${shot.kind}" text must be ${cap} characters or fewer (got ${shot.text.length}).`,
        });
      }
      if (shot.kind === 'claim' && !/[a-z]\s+[a-z]/i.test(shot.text)) {
        ctx.addIssue({
          code: 'custom',
          path: ['shots', i, 'text'],
          message: 'the claim must be a real sentence, not a fragment or a label.',
        });
      }
    });
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
  /** px of camera travel per shot, at the 1920-tall logical canvas */
  cameraTravel: 112,
  minPxPerFrame: 1,
} as const;

export type Effort = 'fast' | 'balanced' | 'cinematic';

/** Real repo content injected into shots that must not be paraphrased. */
export type ShotPayload =
  | { type: 'code'; path: string; lines: string[] }
  | { type: 'commits'; subjects: string[] }
  /** Cards for a bento shot, built from real repo facts rather than written by the model. */
  | { type: 'cards'; items: { title: string; note: string }[] }
  /** The repo's own README hero image, inlined so the browser render needs no network. */
  | { type: 'artwork'; dataUri: string };

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
  /** Feeds the bento cards. Real attributes of the project, never invented. */
  topics?: string[];
  /** The repo's own hero image. Absent for plenty of repos, so every use is guarded. */
  artwork?: { dataUri: string } | null;
  dependencies?: string[];
  languages?: { language: string; share: number }[];
  stars?: number;
  contributorCount?: number | null;
  commitCount?: number | null;
};

/**
 * Three cards for a bento shot, drawn from what the repo actually IS.
 *
 * Deliberately not written by the model: a card grid is exactly the shape that invites
 * invented feature bullets, and invented features are the fastest way to make a generated
 * video worthless. Languages, topics and dependencies are all verifiable facts.
 */
function bentoCards(facts: SpecFacts): { title: string; note: string }[] {
  const cards: { title: string; note: string }[] = [];

  const top = facts.languages?.[0];
  if (top) cards.push({ title: top.language, note: `${top.share}% of the code` });
  if (facts.commitCount) cards.push({ title: String(facts.commitCount), note: 'commits' });
  if (facts.contributorCount) {
    cards.push({ title: String(facts.contributorCount), note: 'contributors' });
  }
  for (const topic of facts.topics ?? []) {
    if (cards.length >= 3) break;
    cards.push({ title: topic, note: 'topic' });
  }
  for (const dep of facts.dependencies ?? []) {
    if (cards.length >= 3) break;
    cards.push({ title: dep, note: 'built on' });
  }
  return cards.slice(0, 3);
}

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
    } else if (shot.kind === 'bento') {
      payload = { type: 'cards', items: bentoCards(facts) };
    } else if (shot.kind === 'artwork' && facts.artwork) {
      payload = { type: 'artwork', dataUri: facts.artwork.dataUri };
    }

    /**
     * Duration comes from the CONTENT, not a constant.
     *
     * Every shot used to run the same 66 frames, so the claim — the one shot whose whole
     * job is to be read — got 2.2 seconds for a sentence that needs about five, while a
     * two-word lockup got the same 2.2 and sat there dead. Reading time is a fact about
     * the text; it is not a style choice.
     */
    const payloadLines =
      payload?.type === 'commits'
        ? payload.subjects.length
        : payload?.type === 'code'
          ? payload.lines.length
          : 0;
    const { frames: durationInFrames } = shotFrames(shot, MOTION.fps, effort, payloadLines);
    const startFrame = cursor;
    cursor += durationInFrames;

    /**
     * The camera moves only where the SHOT needs it to.
     *
     * Every shot used to drift, because a rule said travel must be at least 1px/frame.
     * That rule is real — sub-pixel velocity gets quantised into a 1px lurch and reads as
     * juddering — but it describes how to move, not whether to. Applying it everywhere
     * meant a static line of type slid around for no reason while the viewer was trying to
     * read it, which is what "the movement feels forced" is: motion applied TO content
     * rather than caused BY it.
     *
     * So: shots the eye travels through (a wall of commits, a block of source) get a
     * dolly, because reading them is itself a downward move. Shots that are one held
     * statement do not move at all. Anything that does move still clears the 1px floor.
     */
    const TRAVELS = new Set(['commitwall', 'code']);
    const cameraDy = TRAVELS.has(shot.kind)
      ? (i % 2 === 0 ? 1 : -1) *
        Math.max(MOTION.cameraTravel, durationInFrames * MOTION.minPxPerFrame)
      : 0;

    return { ...shot, startFrame, durationInFrames, cameraDy, payload };
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
          text: {
            type: 'string',
            description:
              'On-screen copy. A "claim" shot is a full plain sentence saying what the project does, up to 96 characters. A "blowout" is ONE word, up to 14. Everything else is up to 34.',
          },
          caption: { type: 'string', description: 'Optional small line under the text. HARD LIMIT 28 characters.' },
        },
        required: ['kind', 'tone', 'text'],
      },
    },
    closer: { type: 'string', description: 'Final line. HARD LIMIT 28 characters.' },
  },
  required: ['hook', 'accent', 'shots', 'closer'],
} as const;
