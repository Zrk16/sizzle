/**
 * Produce a real render spec and write it to disk, so the film can be rendered headlessly
 * and actually looked at. Guessing at video quality from source code does not work.
 *
 * Run: pnpm spec <owner/repo>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeRepo } from '../src/lib/analyze';
import { directVideo } from '../src/lib/direct';
import { toRenderSpec } from '../src/lib/spec';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  process.env[t.slice(0, i).trim()] ||= t.slice(i + 1).trim();
}

const target = process.argv[2] ?? 'darkroomengineering/lenis';
const facts = await analyzeRepo(target);
const { spec, critique } = await directVideo(facts);
const render = toRenderSpec(spec, facts, 'balanced');

writeFileSync(new URL('./sample-spec.json', import.meta.url), JSON.stringify(render, null, 2));

console.log(`hook   "${spec.hook}"   accent ${render.accent}`);
console.log(`shots  ${render.shots.map((s) => `${s.tone}/${s.kind}`).join('  ')}`);
console.log(`frames ${render.durationInFrames} at ${render.width}x${render.height}`);
if (critique) {
  console.log('');
  console.log(`EDITOR: ${critique.revised ? 'sent back for revision' : 'passed'}`);
  critique.problems.forEach((problem) => console.log(`  - ${problem}`));
  console.log(`  stranger test: ${critique.strangerTest}`);
}
console.log('');
console.log('wrote scripts/sample-spec.json');
