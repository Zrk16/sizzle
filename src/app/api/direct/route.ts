import { NextResponse } from 'next/server';
import { analyzeRepo, AnalyzeError } from '@/lib/analyze';
import { directVideo, DirectError } from '@/lib/direct';
import { toRenderSpec, type Effort } from '@/lib/spec';

/**
 * Repo URL in, render spec out. This is the only server work in the product — the video
 * itself is rendered in the visitor's browser, so there is no queue, no worker and no
 * per-render cost. Keys stay here and never reach the client.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const EFFORTS: Effort[] = ['fast', 'balanced', 'cinematic'];

export async function POST(request: Request) {
  let body: { repo?: string; effort?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON with a "repo" field.' }, { status: 400 });
  }

  const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
  if (!repo) return NextResponse.json({ error: 'Which repo?' }, { status: 400 });

  const effort: Effort = EFFORTS.includes(body.effort as Effort)
    ? (body.effort as Effort)
    : 'balanced';

  try {
    const started = Date.now();
    const facts = await analyzeRepo(repo);
    const analyzedAt = Date.now();
    const { spec: ai, model, attempts } = await directVideo(facts);

    return NextResponse.json({
      ai,
      spec: toRenderSpec(ai, facts, effort),
      meta: {
        owner: facts.owner,
        repo: facts.repo,
        stars: facts.stars,
        commits: facts.commitCount,
        language: facts.languages[0]?.language ?? null,
        model,
        attempts,
        analyzeMs: analyzedAt - started,
        directMs: Date.now() - analyzedAt,
      },
    });
  } catch (e) {
    if (e instanceof AnalyzeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    if (e instanceof DirectError) {
      // The director already tried three models and a repair pass before giving up.
      return NextResponse.json(
        { error: 'The director could not write a usable cut for this repo. Try again.' },
        { status: 502 }
      );
    }
    console.error('unexpected /api/direct failure', e);
    return NextResponse.json({ error: 'Something broke on our side.' }, { status: 500 });
  }
}
