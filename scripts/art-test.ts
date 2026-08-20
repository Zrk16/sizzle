import { readFileSync } from 'node:fs';
import { analyzeRepo } from '../src/lib/analyze';

for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#') || !t.includes('=')) continue;
  const i = t.indexOf('=');
  process.env[t.slice(0, i).trim()] ||= t.slice(i + 1).trim();
}

for (const repo of ['darkroomengineering/lenis', 'pallets/flask', 'sindresorhus/slugify']) {
  const f = await analyzeRepo(repo);
  const a = f.artwork;
  console.log(
    repo.padEnd(32),
    a ? `artwork ${Math.round(a.dataUri.length / 1024)}KB  ${a.dataUri.slice(5, 24)}` : 'NO ARTWORK'
  );
}
