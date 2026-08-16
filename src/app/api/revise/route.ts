import { NextResponse } from 'next/server';
import { analyzeRepo, AnalyzeError } from '@/lib/analyze';
import { reviseVideo, DirectError } from '@/lib/direct';
import { aiSpecSchema, toRenderSpec, type Effort } from '@/lib/spec';

/**
 * The back half of the critique loop. The browser rendered a proxy, measured it, and the
 * gate failed something — this hands the model its own cut plus the measurements and asks
 * for a fix.
 *
 * Facts are re-fetched rather than round-tripped through the client: trusting the browser
 * to send back the repo's commit list would let anyone put arbitrary text on screen.
 */

export const runtime = 'nodejs';
export const maxDuration = 60;

const EFFORTS: Effort[] = ['fast', 'balanced', 'cinematic'];

export async function POST(request: Request) {
  let body: { repo?: string; previous?: unknown; notes?: unknown; effort?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 400 });
  }

  const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
  if (!repo) return NextResponse.json({ error: 'Which repo?' }, { status: 400 });

  const previous = aiSpecSchema.safeParse(body.previous);
  if (!previous.success) {
    return NextResponse.json({ error: 'The previous cut was not a valid spec.' }, { status: 400 });
  }

  const notes = Array.isArray(body.notes)
    ? body.notes.filter((n): n is string => typeof n === 'string').slice(0, 10)
    : [];
  if (!notes.length) {
    return NextResponse.json({ error: 'Nothing to fix.' }, { status: 400 });
  }

  const effort: Effort = EFFORTS.includes(body.effort as Effort)
    ? (body.effort as Effort)
    : 'balanced';

  try {
    const facts = await analyzeRepo(repo);
    const started = Date.now();
    const { spec: ai, model, attempts } = await reviseVideo(facts, previous.data, notes);
    return NextResponse.json({
      ai,
      spec: toRenderSpec(ai, facts, effort),
      meta: { model, attempts, reviseMs: Date.now() - started },
    });
  } catch (e) {
    if (e instanceof AnalyzeError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof DirectError) {
      return NextResponse.json({ error: 'The director could not improve this cut.' }, { status: 502 });
    }
    console.error('unexpected /api/revise failure', e);
    return NextResponse.json({ error: 'Something broke on our side.' }, { status: 500 });
  }
}
