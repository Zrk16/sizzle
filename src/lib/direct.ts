import { aiSpecSchema, geminiResponseSchema, type AiSpec } from './spec';
import type { RepoFacts } from './analyze';
import { critiqueWriting } from './critic';

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

/** Newline as a value. Building prompts with escapes inside nested template strings kept
 *  producing literal line breaks in the source rather than in the output. */
const NL = String.fromCharCode(10);

/** Only the facts worth putting on screen. Feeding the whole API blob invites the model
 *  to reach for whatever is numerically largest, which is how you get slop. */
function factSheet(f: RepoFacts): string {
  const lines: string[] = [
    `name: ${f.repo}`,
    f.description ? `description: ${f.description}` : null,
    f.readmeIntro ? `readme says: ${f.readmeIntro}` : f.readmeFirstParagraph ? `readme opens with: ${f.readmeFirstParagraph}` : null,
    `primary language: ${f.languages[0]?.language ?? 'unknown'} (${f.languages[0]?.share ?? 0}% of the code)`,
    f.languages.length > 1 ? `other languages: ${f.languages.slice(1).map((l) => l.language).join(', ')}` : null,
    f.commitCount !== null ? `commits: ${f.commitCount}` : null,
    f.contributorCount !== null ? `contributors: ${f.contributorCount}` : null,
    f.stars ? `stars: ${f.stars}` : null,
    f.forks ? `forks: ${f.forks}` : null,
    f.topics.length ? `topics: ${f.topics.join(', ')}` : null,
    `first commit: ${f.createdAt}, last push: ${f.pushedAt} (${f.ageDays} days old)`,
    f.license ? `license: ${f.license}` : null,
    f.dependencies.length ? `built on: ${f.dependencies.join(', ')}` : null,
    f.homepage ? `homepage: ${f.homepage}` : null,
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
5. Show INTERFACE, not only words. A film made entirely of type is a title sequence. Use
   'bento' or 'pointer' at least once in most cuts — the reference films are mostly product
   surfaces with type as punctuation, not the reverse.
6. The specific beats the generic. This project's real commit messages and real code are unfakeable
   and instantly personal. Star counts and language percentages are punctuation — use at most one
   'stat' shot, never as the opening or the payoff.
7. Short is strong. Every string has a hard character limit; write under it, not up to it.
8. The last shot is always a lockup.
9. Pick ONE accent colour that suits this project. Not a rainbow, not a default blue.

Available shot kinds:
  claim      - REQUIRED, exactly once, in the first three shots. One full plain sentence
               saying what this project actually does, as you would explain it to a
               developer who has never heard of it. Not a slogan, not a fragment, not the
               project name. This is the only shot that is allowed to be a sentence, and
               without it the film says nothing.
  bigtype    - a short display statement, a few words at most, set very large
  commitwall - this developer's real commit subjects, stacked
  code       - real source from the repo
  stat       - one number, EXACTLY as given in the facts. Punctuation only, at most once,
               and never the opening or the payoff.
  bento      - three cards on a tilting glass plane, showing what the project is MADE OF.
               The cards are filled in for you from real facts (language share, commit
               count, contributors, topics). Your 'text' is only a short label above them.
  artwork    - the project's OWN hero image from its README, presented as a lit panel in
               space. This is the only real photograph in the film, so if it is available
               it is almost always worth a shot. Your 'text' is a short caption under it.
  pointer    - a real cursor travels in and presses a button. Your 'text' is the BUTTON
               LABEL: make it the actual action a developer would take with this project,
               two or three words, like "npm i lenis" or "Read the docs".
  lockup     - project name + one line. Always last.

For 'code' and 'commitwall', the real source and the real commit list are inserted for you.
Your 'text' for those two is only a short LABEL above them — do not retype code, do not
copy a file path, and do not quote a single commit. Label them like a director would:
"the actual code", "1072 commits later", "what shipped this month".`;

/**
 * Two worked examples of scripts that would pass review.
 *
 * Rules alone were not enough: the drafts obeyed every constraint and were still flat,
 * because "do not write marketing copy" does not show anyone what good looks like. These
 * are for projects unrelated to anything a user will paste, and the do-not-reuse
 * instruction is explicit — the model has already been caught returning an example hex
 * colour verbatim as its own choice.
 */
const EXAMPLES = `Two examples of the standard expected. They are for OTHER projects. Do not
reuse their words, their structure, or their accent colours.

EXAMPLE A — a date library
  hook:   "Why is date maths still this hard?"
  claim:  "date-fns gives you 200 small functions for working with dates, and you import
           only the ones you use."
  code:   label "the whole implementation"
  commitwall: label "shipped this month"
  stat:   "36847" caption "projects depend on it"
  lockup: "date-fns" caption "one function at a time"
  closer: "Import what you need."

EXAMPLE B — a terminal multiplexer
  hook:   "What happens to your work when SSH drops?"
  claim:  "zellij keeps your terminal sessions alive on the server, so a dropped connection
           costs you nothing."
  bigtype: "It was still running."
  code:   label "the session layer"
  lockup: "zellij" caption "your terminal, persistent"
  closer: "Reconnect. Everything's there."

Notice what both do: the hook asks something a developer has actually felt, the claim is a
plain sentence with no adjectives in it, and the closer is a line worth ending on rather
than a slogan.`;

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
  'Open loud and blunt on a few words, then get quiet and specific.',
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

export type DirectResult = {
  spec: AiSpec;
  model: string;
  attempts: number;
  /** What the writing critic said about the draft, when it ran. */
  critique?: {
    problems: string[];
    strangerTest: string;
    /** 'clean' the draft passed, 'revised' the notes were applied, 'failed' the rewrite
     *  came back invalid and the original draft shipped unchanged. Reporting the third as
     *  a pass hid the fact that nothing had actually been fixed. */
    outcome: 'clean' | 'revised' | 'failed';
    /** Validator complaints from the last failed rewrite. Kept so a recurring structural
     *  failure is visible rather than being silently absorbed. */
    blockedBy?: string[];
  };
};

export async function directVideo(facts: RepoFacts): Promise<DirectResult> {
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  const shotCount = 4 + Math.floor(Math.random() * 4); // 4-7, matching the schema bounds

  const basePrompt =
    `Direct the launch video for this project.\n\n${factSheet(facts)}\n\n` +
    `DIRECTION FOR THIS CUT: ${angle}\n` +
    (facts.artwork
      ? `THIS REPO HAS ITS OWN ARTWORK, so the 'artwork' shot is available and you should ` +
        `strongly consider using it. It is the only real image in the film.${NL}`
      : `THIS REPO HAS NO ARTWORK. The 'artwork' shot is NOT available for this cut; do ` +
        `not use it, it would render empty.${NL}`) +
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
        if (parsed.success) {
          /**
           * Zod proved the shape is legal. It cannot tell whether the writing is any good,
           * and a legal script can still repeat its own hook, paraphrase the README, round
           * a real number, and end on a slogan — all of which shipped.
           *
           * So one editorial pass: a critic reads the draft as COPY, and if it objects the
           * draft goes back with those notes. Draft, then cut. One revision only — a second
           * opinion is worth a round trip, an argument is not.
           */
          const critique = await critiqueWriting(facts, parsed.data);
          if (!critique || critique.verdict === 'pass' || !critique.problems.length) {
            return {
              spec: parsed.data,
              model,
              attempts,
              critique: critique
                ? { problems: [], strangerTest: critique.strangerTest, outcome: 'clean' }
                : undefined,
            };
          }

          /**
           * The revision needs the SAME repair loop the first draft gets.
           *
           * Without it the rewrite failed zod almost every time — measured three runs in a
           * row — and the code then silently shipped the unrevised draft. The critic was
           * finding real faults and every fix was being thrown away, which made the whole
           * loop decorative. A rewrite is harder than a first draft, not easier: it has to
           * satisfy the editor AND still alternate tones, end on a lockup, carry exactly
           * one claim and stay inside the character caps.
           */
          const notes = critique.problems.map((x) => `- ${x}`).join(NL);
          const editorial =
            `${basePrompt}${NL}${NL}You wrote this draft:${NL}${JSON.stringify(parsed.data, null, 1)}${NL}${NL}` +
            `An editor reviewed it and raised these problems. Rewrite to fix EVERY one. ` +
            `Keep what was working; change only what the notes call out.${NL}${notes}`;

          let structural: string[] = [];
          for (let fix = 0; fix < 3; fix++) {
            attempts++;
            try {
              const prompt2 = structural.length
                ? `${editorial}${NL}${NL}Your rewrite was rejected by the validator for these reasons. ` +
                  `Fix them WITHOUT reintroducing anything the editor objected to:${NL}` +
                  structural.map((x) => `- ${x}`).join(NL)
                : editorial;
              const second = await callGemini(model, prompt2);
              const revised = aiSpecSchema.safeParse(second);
              if (revised.success) {
                return {
                  spec: revised.data,
                  model,
                  attempts,
                  critique: {
                    problems: critique.problems,
                    strangerTest: critique.strangerTest,
                    outcome: 'revised',
                  },
                };
              }
              structural = revised.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`);
            } catch {
              break; // model itself is unhappy; ship the draft rather than nothing
            }
          }
          return {
            spec: parsed.data,
            model,
            attempts,
            critique: {
              problems: critique.problems,
              strangerTest: critique.strangerTest,
              outcome: 'failed',
              blockedBy: structural,
            },
          };
        }
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
