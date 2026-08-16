/**
 * End-to-end check for the server half: repo URL -> GitHub facts -> AI direction -> render spec.
 * Run: pnpm try <owner/repo> [more repos...]
 */
import { readFileSync } from 'node:fs';
import { analyzeRepo } from '../src/lib/analyze';
import { directVideo } from '../src/lib/direct';
import { toRenderSpec } from '../src/lib/spec';

// Next loads .env.local automatically; a bare tsx run does not.
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  process.env[t.slice(0, i).trim()] ||= t.slice(i + 1).trim();
}

const targets = process.argv.slice(2);
if (!targets.length) targets.push('darkroomengineering/lenis');

for (const target of targets) {
  console.log(`\n${'='.repeat(72)}\n${target}\n${'='.repeat(72)}`);
  try {
    const t0 = Date.now();
    const facts = await analyzeRepo(target);
    const tAnalyze = Date.now() - t0;

    console.log(
      `facts (${tAnalyze}ms): ${facts.commitCount} commits, ${facts.contributorCount} contributors, ` +
        `${facts.stars} stars, ${facts.languages[0]?.language} ${facts.languages[0]?.share}%, ` +
        `code sample ${facts.codeSample ? facts.codeSample.path : 'NONE'}`
    );

    const t1 = Date.now();
    const { spec, model, attempts } = await directVideo(facts);
    const tDirect = Date.now() - t1;

    console.log(`direction (${tDirect}ms, ${model}, ${attempts} attempt(s)):`);
    console.log(`  hook   "${spec.hook}"   accent ${spec.accent}`);
    for (const s of spec.shots) {
      console.log(`  ${s.tone.padEnd(5)} ${s.kind.padEnd(10)} "${s.text}"${s.caption ? `  / ${s.caption}` : ''}`);
    }
    console.log(`  closer "${spec.closer}"`);

    const render = toRenderSpec(spec, facts, 'balanced');
    const injected = render.shots.filter((s) => s.payload);
    console.log(
      `render spec: ${render.shots.length} shots, ${render.durationInFrames} frames ` +
        `(${(render.durationInFrames / render.fps).toFixed(1)}s) at ${render.width}x${render.height}` +
        (injected.length
          ? ` | injected: ${injected
              .map((s) =>
                s.payload!.type === 'code'
                  ? `${s.payload!.lines.length} lines of ${s.payload!.path}`
                  : `${s.payload!.subjects.length} real commits`
              )
              .join(', ')}`
          : '')
    );
  } catch (e) {
    console.log(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }
}
