/**
 * Repo facts via the GitHub REST API.
 *
 * The original CLI shelled out to `git clone` + `git rev-list`, which cannot work on
 * serverless (no git binary, read-only filesystem). Everything here is HTTP, so it runs
 * anywhere — and the API exposes things a clone never did: stars, topics, license,
 * contributor count, and language totals by BYTES rather than by counting file extensions.
 *
 * Unauthenticated GitHub is 60 req/hr per IP, which a handful of visitors would exhaust.
 * A scopeless token lifts that to 5000/hr, so GITHUB_TOKEN is effectively required.
 */

const API = 'https://api.github.com';

export type RepoFacts = {
  owner: string;
  repo: string;
  description: string | null;
  homepage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  topics: string[];
  license: string | null;
  createdAt: string;
  pushedAt: string;
  ageDays: number;
  languages: { language: string; bytes: number; share: number }[];
  commitCount: number | null;
  recentCommits: string[];
  contributorCount: number | null;
  readmeFirstParagraph: string | null;
  /** Several paragraphs of prose, so the director can actually learn what this does. */
  readmeIntro: string | null;
  /** What it is built on. Often the clearest signal of what a project actually is. */
  dependencies: string[];
  codeSample: { path: string; lines: string[] } | null;
};

export class AnalyzeError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Accepts a full URL, a git@ remote, or a bare `owner/repo`. */
export function parseRepoInput(input: string): { owner: string; repo: string } {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const patterns = [
    /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)/i,
    /^git@github\.com:([^/\s]+)\/([^/\s]+)/i,
    /^([\w.-]+)\/([\w.-]+)$/,
  ];
  for (const p of patterns) {
    const m = trimmed.match(p);
    if (m) return { owner: m[1], repo: m[2] };
  }
  throw new AnalyzeError(`Not a GitHub repo: "${input}"`, 400);
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'sizzle',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const mins = reset ? Math.ceil((Number(reset) * 1000 - Date.now()) / 60000) : null;
    throw new AnalyzeError(
      `GitHub rate limit hit${mins !== null ? `, resets in ~${mins} min` : ''}.`,
      429
    );
  }
  if (!res.ok) throw new AnalyzeError(`GitHub returned ${res.status} for ${path}`, res.status);
  return (await res.json()) as T;
}

/**
 * Total commits without cloning: ask for one commit per page, then read the page number
 * off the `last` rel in the Link header. It is the only cheap way to get this over REST.
 */
async function countViaLinkHeader(path: string): Promise<number | null> {
  const res = await fetch(`${API}${path}`, { headers: headers() });
  if (!res.ok) return null;
  const link = res.headers.get('link');
  if (!link) {
    const body = (await res.json()) as unknown[];
    return Array.isArray(body) ? body.length : null;
  }
  const last = link.split(',').find((s) => s.includes('rel="last"'));
  const page = last?.match(/[?&]page=(\d+)/)?.[1];
  return page ? Number(page) : null;
}

/**
 * Several paragraphs of README prose, not one line.
 *
 * The director was given a single sentence and asked to explain what a project does. It
 * could not, so it paraphrased the tagline and called that the explanation. A README's
 * opening usually contains the actual "what is this and why" — it is just buried under
 * badges, a logo and a table of contents.
 */
const LF = String.fromCharCode(10);

function readmeIntro(markdown: string, limit = 900): string | null {
  const out: string[] = [];
  let used = 0;
  for (const raw of markdown.split(LF)) {
    const line = raw.trim();
    if (!line) continue;
    // Skip the furniture: headings, badges, images, HTML blocks, tables, lists of links.
    if (/^#{1,6}\s/.test(line)) continue;
    if (line.startsWith('![') || line.startsWith('[!') || line.startsWith('<')) continue;
    if (line.startsWith('---') || line.startsWith('|') || line.startsWith('```')) continue;
    if (/^[-*]\s*\[/.test(line)) continue; // bullet that is just a link

    const clean = line
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`>]/g, '')
      .trim();
    if (clean.length < 25) continue;

    out.push(clean);
    used += clean.length;
    if (used >= limit) break;
  }
  return out.length ? out.join(' ').slice(0, limit) : null;
}

function firstParagraph(markdown: string): string | null {
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#') || line.startsWith('![') || line.startsWith('[!')) continue;
    if (line.startsWith('<') || line.startsWith('---') || line.startsWith('|')) continue;
    // strip inline markdown so the model gets clean prose
    const clean = line
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`>]/g, '')
      .trim();
    if (clean.length > 20) return clean.slice(0, 300);
  }
  return null;
}

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|py|go|rs|rb|java|kt|swift|c|cpp|h|cs|php|ex|zig)$/;
const SKIP_PATH = /(^|\/)(node_modules|dist|build|vendor|\.next|test|tests|__tests__|spec)(\/|$)/;

/**
 * Direct dependencies, from whichever manifest the project uses. What something is built
 * on is frequently the clearest signal of what it is — a repo depending on `three` and
 * `gsap` is a different animal from one depending on `express` and `pg`, whatever its
 * README says.
 */
async function readDependencies(owner: string, repo: string, branch: string): Promise<string[]> {
  const tryFile = async (path: string): Promise<string | null> => {
    const r = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`);
    return r.ok ? r.text() : null;
  };

  const pkg = await tryFile('package.json');
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg) as { dependencies?: Record<string, string> };
      return Object.keys(parsed.dependencies ?? {}).slice(0, 14);
    } catch {
      // A malformed manifest is not worth failing the whole analysis over.
    }
  }

  const py = (await tryFile('requirements.txt')) ?? (await tryFile('pyproject.toml'));
  if (py) {
    return py
      .split(LF)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('['))
      .map((l) => l.split(/[=<>~!\[\s]/)[0].replace(/^"|"$/g, '').trim())
      .filter((l) => l.length > 1 && l.length < 40)
      .slice(0, 14);
  }

  const cargo = await tryFile('Cargo.toml');
  if (cargo) {
    const after = cargo.split('[dependencies]')[1] ?? '';
    return after
      .split(LF)
      .map((l) => l.split('=')[0].trim())
      .filter((l) => /^[a-z0-9_-]{2,}$/i.test(l))
      .slice(0, 14);
  }

  return [];
}

/** One real source file, for the code shot. Generic stats are punctuation; code is specific. */
async function pickCodeSample(
  owner: string,
  repo: string,
  branch: string
): Promise<RepoFacts['codeSample']> {
  const tree = await gh<{ tree: { path: string; type: string; size?: number }[]; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
  );
  if (!tree?.tree) return null;

  // Mid-sized files read best: tiny ones are config, huge ones are generated.
  const candidates = tree.tree
    .filter((n) => n.type === 'blob' && CODE_EXT.test(n.path) && !SKIP_PATH.test(n.path))
    .filter((n) => (n.size ?? 0) > 400 && (n.size ?? 0) < 20000)
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0));

  const chosen = candidates[Math.floor(candidates.length / 3)] ?? candidates[0];
  if (!chosen) return null;

  const raw = await fetch(
    `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${chosen.path}`
  );
  if (!raw.ok) return null;
  const text = await raw.text();

  // Skip the import/licence preamble — start where the file actually does something.
  const lines = text.split('\n');
  const start = lines.findIndex(
    (l, i) => i > 3 && l.trim().length > 0 && !/^\s*(import|from|#include|use |package |\/\/|\*|\/\*)/.test(l)
  );
  const from = start > 0 ? start : 0;
  return {
    path: chosen.path,
    lines: lines.slice(from, from + 14).map((l) => l.slice(0, 92)),
  };
}

export async function analyzeRepo(input: string): Promise<RepoFacts> {
  const { owner, repo } = parseRepoInput(input);

  const meta = await gh<{
    description: string | null;
    homepage: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    topics?: string[];
    license?: { spdx_id: string } | null;
    created_at: string;
    pushed_at: string;
    default_branch: string;
    private: boolean;
  }>(`/repos/${owner}/${repo}`);

  if (!meta) throw new AnalyzeError(`No public repo at github.com/${owner}/${repo}`, 404);

  const [langs, commits, commitCount, contributorCount, readme, codeSample, deps] = await Promise.all([
    gh<Record<string, number>>(`/repos/${owner}/${repo}/languages`),
    gh<{ commit: { message: string } }[]>(`/repos/${owner}/${repo}/commits?per_page=30`),
    countViaLinkHeader(`/repos/${owner}/${repo}/commits?per_page=1`),
    countViaLinkHeader(`/repos/${owner}/${repo}/contributors?per_page=1&anon=false`),
    gh<{ content: string; encoding: string }>(`/repos/${owner}/${repo}/readme`),
    pickCodeSample(owner, repo, meta.default_branch).catch(() => null),
    readDependencies(owner, repo, meta.default_branch).catch(() => [] as string[]),
  ]);

  const totalBytes = Object.values(langs ?? {}).reduce((a, b) => a + b, 0) || 1;

  return {
    owner,
    repo,
    description: meta.description,
    homepage: meta.homepage || null,
    stars: meta.stargazers_count,
    forks: meta.forks_count,
    openIssues: meta.open_issues_count,
    topics: meta.topics ?? [],
    license: meta.license?.spdx_id ?? null,
    createdAt: meta.created_at.slice(0, 10),
    pushedAt: meta.pushed_at.slice(0, 10),
    ageDays: Math.round((Date.now() - Date.parse(meta.created_at)) / 86400000),
    languages: Object.entries(langs ?? {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([language, bytes]) => ({
        language,
        bytes,
        share: Math.round((bytes / totalBytes) * 100),
      })),
    commitCount,
    // first line only — commit bodies are noise on screen
    recentCommits: (commits ?? []).map((c) => c.commit.message.split('\n')[0].slice(0, 72)),
    contributorCount,
    readmeFirstParagraph: readme
      ? firstParagraph(Buffer.from(readme.content, 'base64').toString('utf8'))
      : null,
    readmeIntro: readme
      ? readmeIntro(Buffer.from(readme.content, 'base64').toString('utf8'))
      : null,
    dependencies: deps,
    codeSample,
  };
}
