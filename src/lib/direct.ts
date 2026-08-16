import { aiSpecSchema, geminiResponseSchema, type AiSpec } from './spec';
import type { RepoFacts } from './analyze';

/**
 * The AI director.
 *
 * Two things make this more than a "wrap an LLM" call:
 *  1. It decides SHOT KINDS and TONE ORDER, not just copy — the film's direction.
 *  2. When zod rejects the result, the validation errors are fed back to the model as a
 *     correction turn rather than thrown away. Free-form prompting for JSON measured 0/3
 *     valid; schema-enforced output plus this repair loop measured 3/3.
 */

const MODELS = [
  'gemini-3.1-flash-lite', // measured 3/3 valid, ~1.5s
  'gemini-2.5-flash-lite', // measured 3/3 valid, ~1.6s
  'gemini-2.5-flash', // slower (~6s) but a different failure profile
];

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export class DirectError extends Error {}

/** Only the facts worth putting on screen. Feeding the whole API blob invites the model
 *  to reach for whatever is numerically largest, which is how you get slop. */
function factSheet(f: RepoFacts): string {
  const lines: string[] = [
    `name: ${f.repo}`,
    f.description ? `description: ${f.description}` : null,
    f.readmeFirstParagraph ? `readme opens with: ${f.readmeFirstParagraph}` : null,
    `primary language: ${f.languages[0]?.language ?? 'unknown'} (${f.languages[0]?.share ?? 0}% of the code)`,
    f.languages.length > 1 ? `other languages: ${f.languages.slice(1).map((l) => l.language).join(', ')}` : null,
    f.commitCount !== null ? `commits: ${f.commitCount}` : null,
    f.contributorCount !== null ? `contributors: ${f.contributorCount}` : null,
    f.stars ? `stars: ${f.stars}` : null,
    f.forks ? `forks: ${f.forks}` : null,
    f.topics.length ? `topics: ${f.topics.join(', ')}` : null,
    `first commit: ${f.createdAt}, last push: ${f.pushedAt} (${f.ageDays} days old)`,
    f.license ? `license: ${f.license}` : null,
  ].filter(Boolean) as string[];

  if (f.recentCommits.length) {
    lines.push(`recent commit subjects (real, use them verbatim if you use them at all):`);
    lines.push(...f.recentCommits.slice(0, 12).map((c) => `  - ${c}`));
  }
  if (f.codeSample) {
    lines.push(`a real source file, ${f.codeSample.path}:`);
    lines.push(...f.codeSample.lines.map((l) => `  ${l}`));
  }
  return lines.join('\n');
}

const SYSTEM = `You are directing a short launch video for a software project. You are not writing a README and not writing marketing copy — you are choosing shots.

RULES, in priority order:
1. Never invent a number, a feature, or a claim. Everything on screen must trace to the facts given.
2. The film must EXPLAIN, not just evoke. A viewer who has never heard of this project must
   finish it able to say what the project does. Structure: hook (a question) -> claim (what
   it is, in a sentence) -> proof (its real code, its real commits, one number at most) ->
   lockup. A sequence of moody fragments with a name at the end is a failure, however
   good the individual lines are.
3. The hook is a QUESTION that makes a developer curious. Not a slogan, not the project name.
4. Adjacent shots must use different tones. ink is dark, paper is light, flood is the accent colour
   filling the frame. The tone change IS the cut — same tone twice reads as one long slide.
5. The specific beats the generic. This project's real commit messages and real code are unfakeable
   and instantly personal. Star counts and language percentages are punctuation — use at most one
   'stat' shot, never as the opening or the payoff.
6. Short is strong. Every string has a hard character limit; write under it, not up to it.
7. The last shot is always a lockup.
8. Pick ONE accent colour that suits this project. Not a rainbow, not a default blue.

Available shot kinds:
  claim      - REQUIRED, exactly once, in the first three shots. One full plain sentence
               saying what this project actually does, as you would explain it to a
               developer who has never heard of it. Not a slogan, not a fragment, not the
               project name. This is the only shot that is allowed to be a sentence, and
               without it the film says nothing.
  bigtype    - oversized words, the display statement
  blowout    - a single word wider than the frame, for one hard beat
  typeon     - text revealed per character with a caret, good for a command or a claim
  commitwall - this developer's real commit subjects, stacked
  code       - real source from the repo
  stat       - one number. Punctuation only, at most once.
  stack      - cards dropping in, good for a list of three things
  lockup     - project name + one line. Always last.

For 'code' and 'commitwall', the real source and the real commit list are inserted for you.
Your 'text' for those two is only a short LABEL above them — do not retype code, do not
copy a file path, and do not quote a single commit. Label them like a director would:
"the actual code", "1072 commits later", "what shipped this month".`;

/**
 * Anti-stock variety. Without this every repo produced the identical skeleton —
 * bigtype, code, commitwall, stat, lockup — five shots, every single time. The schema
 * permits 4-7 shots and eight kinds; the model just has a favourite. Rotating an explicit
 * structural brief per run is the cheapest way to make two videos feel different, which
 * is the whole difference between a tool and a template.
 */
const ANGLES = [
  'Open on the problem this project exists to solve, and do not name the project until the lockup.',
  'Open on the scale of the work — the commits, the years, the contributors — then reveal what it is.',
  'Open on the code itself. Let the source be the first thing on screen.',
  'Structure it as a question, a wrong answer, then the right answer.',
  'Open loud with a blowout on one single word, then get quiet and specific.',
  'Tell it as a before and after: what building this was like without the project, then with it.',
  'Lead with the most recent work — what this developer shipped lately — then widen out.',
];

async function callGemini(model: string, prompt: string): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new DirectError('GEMINI_API_KEY is not set');

  const res = await fetch(ENDPOINT(model), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: geminiResponseSchema,
        temperature: 1.0, // two runs on the same repo should not produce the same film
      },
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new DirectError(`${model}: HTTP ${res.status} ${json?.error?.message ?? ''}`.slice(0, 200));
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new DirectError(`${model}: empty response`);
  return JSON.parse(text);
}

export type DirectResult = { spec: AiSpec; model: string; attempts: number };

export async function directVideo(facts: RepoFacts): Promise<DirectResult> {
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  const shotCount = 4 + Math.floor(Math.random() * 4); // 4-7, matching the schema bounds

  const basePrompt =
    `Direct the launch video for this project.\n\n${factSheet(facts)}\n\n` +
    `DIRECTION FOR THIS CUT: ${angle}\n` +
    `Use exactly ${shotCount} shots. Do not default to a familiar running order — ` +
    `vary which kind opens, and do not use 'stat' unless a number here is genuinely worth a whole shot.`;
  const problems: string[] = [];
  let attempts = 0;
  let lastError = 'no attempt made';

  for (const model of MODELS) {
    // Two shots per model: one clean, one with the validator's complaints fed back.
    for (let pass = 0; pass < 2; pass++) {
      attempts++;
      const prompt =
        pass === 0 || problems.length === 0
          ? basePrompt
          : `${basePrompt}\n\nYour previous attempt was rejected for these reasons. Fix all of them:\n${problems
              .map((p) => `- ${p}`)
              .join('\n')}`;
      try {
        const raw = await callGemini(model, prompt);
        const parsed = aiSpecSchema.safeParse(raw);
        if (parsed.success) return { spec: parsed.data, model, attempts };
        problems.length = 0;
        problems.push(...parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
        lastError = problems.join('; ');
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        break; // model itself is unhappy — move to the next one rather than retry it
      }
    }
  }

  throw new DirectError(`Every model failed after ${attempts} attempts. Last: ${lastError}`);
}

/**
 * The second half of the critique loop: the film has been rendered and measured, and the
 * gate has complaints. Hand the model its own cut plus what the measurements said and let
 * it fix the specific failures.
 *
 * This is the part that makes the AI a director rather than a copywriter — it is reacting
 * to how its work actually turned out, not just generating once and hoping.
 */
export async function reviseVideo(
  facts: RepoFacts,
  previous: AiSpec,
  notes: string[]
): Promise<DirectResult> {
  const prompt =
    `Here are the facts for this project again:\n\n${factSheet(facts)}\n\n` +
    `This is the cut you directed:\n${JSON.stringify(previous, null, 1)}\n\n` +
    `It was rendered and measured. The gate reported these failures:\n` +
    notes.map((n) => `- ${n}`).join('\n') +
    `\n\nRevise the cut to fix every failure above. Keep what was working — the hook and the ` +
    `overall idea should survive unless a failure is specifically about them. Change tones, ` +
    `shot kinds, shot count and copy as needed.`;

  let attempts = 0;
  let lastError = 'no attempt made';
  for (const model of MODELS) {
    attempts++;
    try {
      const raw = await callGemini(model, prompt);
      const parsed = aiSpecSchema.safeParse(raw);
      if (parsed.success) return { spec: parsed.data, model, attempts };
      lastError = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new DirectError(`Revision failed after ${attempts} attempts. Last: ${lastError}`);
}
