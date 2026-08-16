'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { Film } from '@/video/Film';
import { critique } from '@/lib/critique';
import { critiqueNotes, type Score } from '@/lib/score';
import type { RenderSpec, AiSpec, Effort } from '@/lib/spec';
import styles from './director.module.css';

/**
 * The app itself, sitting under the wordmark.
 *
 * The critique loop is staged as BALLOTS because that is literally what it is: a first
 * ballot that fails, the notes explaining why, and a second ballot after the director has
 * responded to them. Framing it as a ceremony's judging step means a viewer understands
 * the mechanism without anyone narrating it.
 */

type Meta = { owner: string; repo: string; model: string; attempts: number; directMs: number };

const EFFORTS: { id: Effort; label: string; runtime: string }[] = [
  { id: 'fast', label: 'Fast', runtime: 'shorter shots' },
  { id: 'balanced', label: 'Balanced', runtime: 'default' },
  { id: 'cinematic', label: 'Cinematic', runtime: 'longer holds' },
];

const EXAMPLES = ['darkroomengineering/lenis', 'pallets/flask', 'sindresorhus/slugify'];

export function Director() {
  const [repo, setRepo] = useState('');
  const [effort, setEffort] = useState<Effort>('balanced');
  const [ai, setAi] = useState<AiSpec | null>(null);
  const [spec, setSpec] = useState<RenderSpec | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [ballots, setBallots] = useState<{ score: Score; label: string; notes: string[] }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const direct = useCallback(
    async (target?: string) => {
      const which = (target ?? repo).trim();
      if (!which || busy) return;
      setBusy(true);
      setError(null);
      setSpec(null);
      setAi(null);
      setBallots([]);
      setStatus('Reading the nominee…');
      try {
        const res = await fetch('/api/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: which, effort }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        setAi(json.ai);
        setSpec(json.spec);
        setMeta(json.meta);
        setStatus(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setStatus(null);
      } finally {
        setBusy(false);
      }
    },
    [repo, effort, busy]
  );

  const judge = useCallback(async () => {
    if (!spec || !ai || busy) return;
    setBusy(true);
    setError(null);
    try {
      const first = await critique(spec, Film, setStatus);
      const notes = critiqueNotes(first.score);
      setBallots([{ score: first.score, label: 'First ballot', notes }]);
      if (!notes.length) {
        setStatus(null);
        setBusy(false);
        return;
      }

      setStatus('The director is responding to the notes…');
      const res = await fetch('/api/revise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, previous: ai, notes, effort }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);

      setAi(json.ai);
      setSpec(json.spec);
      const second = await critique(json.spec, Film, setStatus);
      setBallots((b) => [
        ...b,
        { score: second.score, label: 'Second ballot', notes: critiqueNotes(second.score) },
      ]);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [spec, ai, repo, effort, busy]);

  const collect = useCallback(async () => {
    if (!spec || busy) return;
    setBusy(true);
    setError(null);
    setStatus('Cutting the print, in your browser…');
    abort.current = new AbortController();
    try {
      const { renderMediaOnWeb } = await import('@remotion/web-renderer');
      const { getBlob } = await renderMediaOnWeb({
        licenseKey: 'free-license',
        composition: {
          component: Film,
          defaultProps: { spec },
          durationInFrames: spec.durationInFrames,
          fps: spec.fps,
          width: spec.width,
          height: spec.height,
          id: 'sizzle',
        },
        inputProps: { spec },
        signal: abort.current.signal,
      });
      const url = URL.createObjectURL(await getBlob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${meta?.repo ?? 'sizzle'}.mp4`;
      // Firefox ignores a click on an anchor that was never in the document, and revoking
      // the object URL in the same tick can cancel the download before it starts.
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [spec, meta, busy]);

  return (
    <section className={styles.director}>
      <div className={styles.sceneHead}>
        <p className="slug">Scene 02 — The cut</p>
        <h2 className={`display ${styles.sceneTitle}`}>Your commit log is the script.</h2>
      </div>

      <div className={styles.slate}>
        <div className={styles.entry}>
          <input
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && direct()}
            placeholder="github.com/owner/repo"
            className={styles.input}
            spellCheck={false}
            aria-label="GitHub repository"
          />
          <button onClick={() => direct()} disabled={busy} className={styles.primary}>
            Roll it
          </button>
        </div>

        <div className={styles.row}>
          <p className="slug">Runtime</p>
          <div className={styles.pills}>
            {EFFORTS.map((e) => (
              <button
                key={e.id}
                onClick={() => setEffort(e.id)}
                className={effort === e.id ? `${styles.pill} ${styles.pillOn}` : styles.pill}
              >
                {e.label}
                <span className={styles.pillNote}>{e.runtime}</span>
              </button>
            ))}
          </div>
        </div>

        {!spec && !busy && (
          <div className={styles.row}>
            <p className="slug">Or screen one of these</p>
            <div className={styles.pills}>
              {EXAMPLES.map((x) => (
                <button
                  key={x}
                  className={styles.pill}
                  onClick={() => {
                    setRepo(x);
                    direct(x);
                  }}
                >
                  {x.split('/')[1]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {status && <p className={styles.status}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {spec && (
        <>
          <div className={styles.screen}>
            <Player
              component={Film}
              inputProps={{ spec }}
              durationInFrames={spec.durationInFrames}
              fps={spec.fps}
              compositionWidth={spec.width}
              compositionHeight={spec.height}
              style={{ width: '100%' }}
              controls
              autoPlay
              loop
            />
          </div>

          <div className={styles.actions}>
            <button onClick={judge} disabled={busy} className={styles.primary}>
              Send it to the panel
            </button>
            <button onClick={collect} disabled={busy} className={styles.ghost}>
              Collect the print
            </button>
            {meta && (
              <p className="slug">
                {spec.shots.length} shots · {(spec.durationInFrames / spec.fps).toFixed(1)}s ·{' '}
                {meta.model}
              </p>
            )}
          </div>

          {ballots.length > 0 && (
            <div className={styles.ballots}>
              {ballots.map((ballot, i) => {
                const passed = ballot.score.passed === ballot.score.total;
                return (
                  <article key={i} className={styles.ballot}>
                    <header className={styles.ballotHead}>
                      <p className="slug">{ballot.label}</p>
                      <p className={passed ? styles.stampPass : styles.stampFail}>
                        {passed ? 'Passed' : 'Held'}
                      </p>
                      <p className="slug">
                        {ballot.score.passed} of {ballot.score.total} clear
                      </p>
                    </header>

                    <dl className={styles.metrics}>
                      {ballot.score.metrics.map((m) => (
                        <div
                          key={m.id}
                          className={m.ok ? styles.metric : `${styles.metric} ${styles.metricBad}`}
                        >
                          <dt>{m.label}</dt>
                          <dd>
                            {m.value}
                            {m.unit}
                          </dd>
                        </div>
                      ))}
                    </dl>

                    {ballot.notes.length > 0 && (
                      <ul className={styles.notes}>
                        {ballot.notes.map((n, j) => (
                          <li key={j}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
