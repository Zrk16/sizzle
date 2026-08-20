import type { AiSpec } from './spec';
import type { RepoFacts } from './analyze';

/**
 * The writing critic.
 *
 * The existing gate measures PIXELS — luminance, coverage, cut visibility, motion, freeze.
 * It has nothing to say about whether the copy is any good, which is why a cut could score
 * well and still read like this:
 *
 *   hook    "Does your scroll feel... rough?"
 *   bigtype "Janky scrolling?"          <- the hook again, in different words
 *   claim   paraphrase of the README
 *   blowout "FRICTION"                  <- an abstract noun, alone, meaning nothing
 *   stat    "15,000+ stars"             <- the real number is 15,430
 *   closer  "Smooth scroll, perfected." <- marketing filler
 *
 * Every one of those is a writing fault and none of them is visible to a luminance meter.
 * So: a second pass that reads the spec as COPY and is told to be hard on it.
 *
 * It runs adversarially on purpose. Asking a model "is this good?" gets "yes" almost
 * every time; asking it to find what a sharp editor would cut gets real answers.
 */

const ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

const CRITIC_MODEL = 'gemini-3.1-flash-lite';

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'revise'] },
    problems: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'string',
        description:
          'One concrete fault and the fix, in one sentence. Name the offending shot or field.',
      },
    },
    strangerTest: {
      type: 'string',
      description:
        'In one sentence, what a viewer who had never heard of this project would be able to say it does after watching. If they could not say anything specific, say so plainly.',
    },
  },
  required: ['verdict', 'problems', 'strangerTest'],
} as const;

const CRITIC_SYSTEM = `You are a hard, experienced editor reviewing the script for a short launch video. You are not the writer and you are not here to be encouraging. Your job is to find what is weak, and you are judged on catching things, not on being kind.

Mark "revise" if ANY of these are true. Be strict; most first drafts fail at least one.

1. REDUNDANCY. Two shots make the same point, or a shot restates the hook in different words. The hook already ran; a shot that repeats it wastes a beat.
2. THE CLAIM IS NOT AN EXPLANATION. It paraphrases the tagline, or it is vague ("a modern solution for developers"). A stranger must finish the claim knowing what the thing DOES.
3. MARKETING FILLER. "perfected", "reimagined", "seamless", "powerful", "effortless", "revolutionise", "unlock", "elevate", "game-changing", "next-level". Also any sentence that would fit any project in the category.
4. ABSTRACT NOUNS ALONE. A single word like "FRICTION" or "VELOCITY" on its own frame means nothing without context.
5. INVENTED OR ROUNDED FACTS. Every number must appear EXACTLY as given in the facts. "15,000+" when the fact says 15,430 is a fault. So is any capability not stated in the facts.
6. A WEAK ENDING. The closer restates the claim, or it is a slogan rather than a line worth ending on.
7. NOTHING SPECIFIC TO THIS PROJECT. If the script would work for any library in the same category with the name swapped, it has failed.

Return "pass" only if you would put your own name on it.`;

export type WritingCritique = {
  verdict: 'pass' | 'revise';
  problems: string[];
  strangerTest: string;
};

/** Compact view of the facts — enough to check claims against, no more. */
function factsForChecking(f: RepoFacts): string {
  return [
    `name: ${f.repo}`,
    f.description ? `description: ${f.description}` : null,
    f.readmeIntro ? `readme: ${f.readmeIntro}` : null,
    `stars: ${f.stars}`,
    `forks: ${f.forks}`,
    f.commitCount !== null ? `commits: ${f.commitCount}` : null,
    f.contributorCount !== null ? `contributors: ${f.contributorCount}` : null,
    `languages: ${f.languages.map((l) => `${l.language} ${l.share}%`).join(', ')}`,
    f.topics.length ? `topics: ${f.topics.join(', ')}` : null,
    f.dependencies.length ? `built on: ${f.dependencies.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function critiqueWriting(
  facts: RepoFacts,
  spec: AiSpec
): Promise<WritingCritique | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const script = [
    `hook: ${spec.hook}`,
    ...spec.shots.map((s, i) => `shot ${i + 1} (${s.kind}): ${s.text}${s.caption ? ` / ${s.caption}` : ''}`),
    `closer: ${spec.closer}`,
  ].join('\n');

  const prompt = `THE FACTS (everything on screen must trace to these):\n${factsForChecking(facts)}\n\nTHE SCRIPT:\n${script}`;

  try {
    const res = await fetch(ENDPOINT(CRITIC_MODEL), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CRITIC_SYSTEM }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: CRITIC_SCHEMA,
          // Low temperature: a critic should be consistent, not creative.
          temperature: 0.2,
        },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as WritingCritique;
    if (parsed.verdict !== 'pass' && parsed.verdict !== 'revise') return null;
    return parsed;
  } catch {
    // The critic is an improvement pass, not a gate. If it fails, ship the draft rather
    // than failing the whole request over a second opinion.
    return null;
  }
}
