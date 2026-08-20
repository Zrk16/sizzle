import { readFileSync, writeFileSync } from 'node:fs';
import { buildScore } from '../src/video/audio';
import type { RenderSpec } from '../src/lib/spec';

const spec = JSON.parse(
  readFileSync(new URL('./sample-spec.json', import.meta.url), 'utf8')
) as RenderSpec;

const score = buildScore(spec);
const base64 = score.dataUri.split(',')[1];
const buf = Buffer.from(base64, 'base64');
writeFileSync(new URL('../out/score.wav', import.meta.url), buf);

console.log(`score: ${score.seconds.toFixed(1)}s, ${score.hits} hits, ${(buf.length / 1024).toFixed(0)} KB`);
console.log('cut times (s):', spec.shots.slice(1).map((s) => (s.startFrame / spec.fps).toFixed(2)).join('  '));

// Determinism: the same spec must produce byte-identical audio, or a seeked render desyncs.
const again = buildScore(spec);
console.log('deterministic:', again.dataUri === score.dataUri);
