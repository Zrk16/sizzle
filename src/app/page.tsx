'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { Film } from '@/video/Film';
import type { RenderSpec, Effort } from '@/lib/spec';

/**
 * Functional shell. The visual design pass is a separate job — this exists to prove the
 * whole path end to end: repo -> facts -> AI direction -> playing film -> MP4 in hand.
 *
 * The render happens HERE, in the visitor's browser, via @remotion/web-renderer. That is
 * what makes the effort slider free: a longer render costs the visitor seconds on their
 * own GPU and costs the service nothing at all.
 */

type Meta = {
  owner: string;
  repo: string;
  stars: number;
  commits: number | null;
  language: string | null;
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

export default function Home() {
  const [repo, setRepo] = useState('');
  const [effort, setEffort] = useState<Effort>('balanced');
  const [spec, setSpec] = useState<RenderSpec | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const direct = useCallback(async () => {
    if (!repo.trim()) return;
    setError(null);
    setSpec(null);
    setMeta(null);
    setStatus('Reading the repo…');
    try {
      const res = await fetch('/api/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, effort }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSpec(json.spec);
      setMeta(json.meta);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus(null);
    }
  }, [repo, effort]);

  const download = useCallback(async () => {
    if (!spec) return;
    setRendering(true);
    setError(null);
    setStatus('Rendering in your browser…');
    abort.current = new AbortController();
    try {
      // Imported lazily: the renderer is a large chunk and most visitors watch without
      // ever downloading, so it should not be in the initial bundle.
      const { renderMediaOnWeb } = await import('@remotion/web-renderer');
      const { getBlob } = await renderMediaOnWeb({
        licenseKey: 'free-license',
        composition: {
          component: Film as React.FC,
          durationInFrames: spec.durationInFrames,
          fps: spec.fps,
          width: spec.width,
          height: spec.height,
          id: 'sizzle',
        },
        inputProps: { spec },
        signal: abort.current.signal,
      });
      const blob = await getBlob();
      const url = URL.createObjectURL(blob);
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
      setRendering(false);
    }
  }, [spec, meta]);

  const seconds = useMemo(
    () => (spec ? (spec.durationInFrames / spec.fps).toFixed(1) : null),
    [spec]
  );

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
          disabled={!!status || rendering}
          style={{
            padding: '14px 26px',
            borderRadius: 10,
            border: 0,
            background: '#FF4D00',
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
        <p style={{ color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', padding: 14, borderRadius: 10 }}>
          {error}
        </p>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 18, flexWrap: 'wrap' }}>
            <button
              onClick={download}
              disabled={rendering}
              style={{
                padding: '13px 24px',
                borderRadius: 10,
                border: '1px solid rgba(244,243,240,0.22)',
                background: 'transparent',
                color: '#f4f3f0',
                fontWeight: 600,
              }}
            >
              {rendering ? 'Rendering…' : 'Download MP4'}
            </button>
            {meta && (
              <span style={{ color: 'rgba(244,243,240,0.45)', fontSize: 14 }}>
                {spec.shots.length} shots · {seconds}s · directed by {meta.model} in{' '}
                {meta.attempts} attempt{meta.attempts > 1 ? 's' : ''} ({meta.directMs}ms)
              </span>
            )}
          </div>
        </>
      )}
    </main>
  );
}
