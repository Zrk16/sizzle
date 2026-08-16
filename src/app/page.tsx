'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { Film } from '@/video/Film';
import { critique } from '@/lib/critique';
import { critiqueNotes } from '@/lib/score';
import type { Score } from '@/lib/score';
import type { RenderSpec, AiSpec, Effort } from '@/lib/spec';

/**
 * Functional shell. The visual design pass is a separate job — this exists to prove the
 * whole path: repo -> facts -> AI direction -> playing film -> measured -> revised -> MP4.
 *
 * The render and the grading both happen HERE, in the visitor's browser. That is what
 * makes the effort slider free and what makes the critique loop something you can watch
 * rather than something claimed in a README.
 */

type Meta = {
  owner: string;
  repo: string;
  model: string;
  attempts: number;
  analyzeMs: number;
  directMs: number;
};

const EFFORTS: { id: Effort; label: string; note: string }[] = [
  { id: 'fast', label: 'Fast', note: 'shorter shots' },
  { id: 'balanced', label: 'Balanced', note: 'default' },
  { id: 'cinematic', label: 'Cinematic', note: 'longer holds' },
];

const PANEL: React.CSSProperties = {
  border: '1px solid rgba(244,243,240,0.12)',
  borderRadius: 12,
  padding: 18,
};

export default function Home() {
  const [repo, setRepo] = useState('');
  const [effort, setEffort] = useState<Effort>('balanced');
  const [ai, setAi] = useState<AiSpec | null>(null);
  const [spec, setSpec] = useState<RenderSpec | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [history, setHistory] = useState<{ score: Score; label: string }[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const direct = useCallback(async () => {
    if (!repo.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSpec(null);
    setAi(null);
    setHistory([]);
    setStatus('Reading the repo…');
    try {
      const res = await fetch('/api/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, effort }),
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
  }, [repo, effort, busy]);

  /** Render a proxy, measure it, and if the gate complains, let the director fix it. */
  const improve = useCallback(async () => {
    if (!spec || !ai || busy) return;
    setBusy(true);
    setError(null);
    try {
      const first = await critique(spec, Film, setStatus);
      setHistory([{ score: first.score, label: 'First cut' }]);

      const notes = critiqueNotes(first.score);
      if (!notes.length) {
        setStatus(null);
        setBusy(false);
        return;
      }

      setStatus(`${notes.length} problem${notes.length > 1 ? 's' : ''} found — revising…`);
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
      setHistory((h) => [...h, { score: second.score, label: 'After revision' }]);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }, [spec, ai, repo, effort, busy]);

  const download = useCallback(async () => {
    if (!spec || busy) return;
    setBusy(true);
    setError(null);
    setStatus('Rendering in your browser…');
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
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '64px 32px 96px' }}>
      <h1 style={{ fontSize: 42, letterSpacing: '-0.04em', margin: '0 0 8px' }}>sizzle</h1>
      <p style={{ color: 'rgba(244,243,240,0.55)', margin: '0 0 40px', fontSize: 18 }}>
        Paste a GitHub repo. Get a launch video built from your real commits and real code.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && direct()}
          placeholder="github.com/owner/repo"
          style={{
            flex: 1,
            padding: '14px 18px',
            borderRadius: 10,
            border: '1px solid rgba(244,243,240,0.16)',
            background: '#111114',
            color: '#f4f3f0',
            fontSize: 16,
          }}
        />
        <button
          onClick={direct}
          disabled={busy}
          style={{
            padding: '14px 26px',
            borderRadius: 10,
            border: 0,
            background: busy ? '#3a3a3e' : '#FF4D00',
            color: '#fff',
            fontWeight: 600,
          }}
        >
          Direct it
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {EFFORTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setEffort(e.id)}
            style={{
              padding: '9px 16px',
              borderRadius: 999,
              border: `1px solid ${effort === e.id ? '#FF4D00' : 'rgba(244,243,240,0.16)'}`,
              background: effort === e.id ? 'rgba(255,77,0,0.12)' : 'transparent',
              color: effort === e.id ? '#FF4D00' : 'rgba(244,243,240,0.6)',
              fontSize: 14,
            }}
          >
            {e.label} <span style={{ opacity: 0.55 }}>· {e.note}</span>
          </button>
        ))}
      </div>

      {status && <p style={{ color: '#FF4D00' }}>{status}</p>}
      {error && (
        <p style={{ ...PANEL, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>{error}</p>
      )}

      {spec && (
        <>
          <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(244,243,240,0.12)' }}>
            <Player
              component={Film as React.FC}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <button
              onClick={improve}
              disabled={busy}
              style={{
                padding: '13px 24px',
                borderRadius: 10,
                border: '1px solid #FF4D00',
                background: 'rgba(255,77,0,0.1)',
                color: '#FF4D00',
                fontWeight: 600,
              }}
            >
              Grade &amp; improve
            </button>
            <button
              onClick={download}
              disabled={busy}
              style={{
                padding: '13px 24px',
                borderRadius: 10,
                border: '1px solid rgba(244,243,240,0.22)',
                background: 'transparent',
                color: '#f4f3f0',
                fontWeight: 600,
              }}
            >
              Download MP4
            </button>
            {meta && (
              <span style={{ color: 'rgba(244,243,240,0.45)', fontSize: 14 }}>
                {spec.shots.length} shots · {(spec.durationInFrames / spec.fps).toFixed(1)}s ·{' '}
                {meta.model}
              </span>
            )}
          </div>

          {history.length > 0 && (
            <div style={{ ...PANEL, marginTop: 22 }}>
              {history.map((h, i) => (
                <div key={i} style={{ marginBottom: i < history.length - 1 ? 20 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <strong style={{ fontSize: 15 }}>{h.label}</strong>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        color: h.score.passed === h.score.total ? '#4ade80' : '#FF4D00',
                      }}
                    >
                      {h.score.passed}/{h.score.total}
                    </span>
                  </div>
                  {h.score.metrics.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        gap: 10,
                        fontSize: 13,
                        fontFamily: 'ui-monospace, monospace',
                        color: m.ok ? 'rgba(244,243,240,0.5)' : '#f87171',
                        lineHeight: 1.9,
                      }}
                    >
                      <span style={{ width: 14 }}>{m.ok ? '✓' : '✕'}</span>
                      <span style={{ width: 150 }}>{m.label}</span>
                      <span>
                        {m.value}
                        {m.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
