/** Dev-only: prove the site-screenshot path without spending a director call. */
import { readFileSync, writeFileSync } from 'node:fs';
import { analyzeRepo } from '../src/lib/analyze';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  process.env[t.slice(0, i).trim()] ||= t.slice(i + 1).trim();
}

const facts = await analyzeRepo(process.argv[2] ?? 'darkroomengineering/lenis');
console.log('homepage:', facts.homepage);
console.log('siteShot:', facts.siteShot ? `${facts.siteShot.site} ${facts.siteShot.width}x${facts.siteShot.height} ${(facts.siteShot.dataUri.length / 1024).toFixed(0)}KB` : 'NONE');
if (!facts.siteShot) process.exit(1);

const p = new URL('./sample-spec.json', import.meta.url);
const spec = JSON.parse(readFileSync(p, 'utf8'));
const i = spec.shots.findIndex((s: { kind: string }) => s.kind === 'bento');
spec.shots[i].kind = 'artwork';
spec.shots[i].tone = 'ink';
spec.shots[i].text = 'See it running';
spec.shots[i].payload = { type: 'screen', dataUri: facts.siteShot.dataUri, site: facts.siteShot.site };
writeFileSync(p, JSON.stringify(spec, null, 2));
console.log(`patched shot ${i} -> artwork/screen`);
