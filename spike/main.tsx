import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderMediaOnWeb } from '@remotion/web-renderer';
import { TestCard, TestCardInner } from './TestCard';
import { Isolate } from './Isolate';

const FPS = 30;
const REF_FRAME = 45; // where both sides are sampled — past the baseline animation's start

/**
 * Tier definitions for the effort slider. The whole point of this harness is to
 * replace the guessed seconds on the UI with measured ones, so every tier renders
 * the identical composition and only the knobs change.
 */
const TIERS = [
  { name: 'Fast', width: 1280, height: 720, durationInFrames: 150 },
  { name: 'Balanced', width: 1920, height: 1080, durationInFrames: 150 },
  { name: 'Cinematic', width: 1920, height: 1080, durationInFrames: 450 },
] as const;

type Result = {
  tier: string;
  seconds: number;
  mb: number;
  url: string;
  frameUrl: string | null;
};

/** Decode one frame out of the rendered blob so it can be eyeballed against the DOM. */
async function grabFrame(url: string, atSeconds: number): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    const fail = () => resolve(null);
    video.onerror = fail;
    video.onloadeddata = () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.05));
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return fail();
      ctx.drawImage(video, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    setTimeout(fail, 15000);
  });
}

const App: React.FC = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (tier: (typeof TIERS)[number]) => {
    setBusy(tier.name);
    setError(null);
    try {
      const started = performance.now();
      const { getBlob } = await renderMediaOnWeb({
        licenseKey: 'free-license',
        composition: {
          component: TestCard,
          durationInFrames: tier.durationInFrames,
          fps: FPS,
          width: tier.width,
          height: tier.height,
          id: `spike-${tier.name}`,
        },
      });
      const blob = await getBlob();
      const seconds = (performance.now() - started) / 1000;
      const url = URL.createObjectURL(blob);
      const frameUrl = await grabFrame(url, REF_FRAME / FPS);
      setResults((r) => [
        ...r.filter((x) => x.tier !== tier.name),
        { tier: tier.name, seconds, mb: blob.size / 1e6, url, frameUrl },
      ]);
    } catch (e) {
      setError(`${tier.name} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ fontFamily: 'monospace', padding: 24, background: '#08080b', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>web-renderer spike</h1>

      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        {TIERS.map((t) => (
          <button
            key={t.name}
            id={`run-${t.name}`}
            onClick={() => run(t)}
            disabled={busy !== null}
            style={{
              padding: '10px 18px',
              background: busy === t.name ? '#444' : '#2563eb',
              color: '#fff',
              border: 0,
              borderRadius: 8,
              cursor: busy ? 'wait' : 'pointer',
              fontFamily: 'monospace',
              fontSize: 14,
            }}
          >
            {busy === t.name ? `rendering ${t.name}...` : `render ${t.name}`}
          </button>
        ))}
      </div>

      <button
        id="run-isolate"
        onClick={async () => {
          setBusy('isolate');
          setError(null);
          try {
            const { getBlob } = await renderMediaOnWeb({
              licenseKey: 'free-license',
              composition: { component: Isolate, durationInFrames: 6, fps: 30, width: 400, height: 240, id: 'isolate' },
            });
            const url = URL.createObjectURL(await getBlob());
            const frameUrl = await grabFrame(url, 0.1);
            setResults((r) => [
              ...r.filter((x) => x.tier !== 'isolate'),
              { tier: 'isolate', seconds: 0, mb: 0, url, frameUrl },
            ]);
          } catch (e) {
            setError(`isolate failed: ${e instanceof Error ? e.message : String(e)}`);
          } finally {
            setBusy(null);
          }
        }}
        disabled={busy !== null}
        style={{ padding: '10px 18px', background: '#7c3aed', color: '#fff', border: 0, borderRadius: 8, fontFamily: 'monospace', fontSize: 14, marginBottom: 8 }}
      >
        run isolation test
      </button>

      <div id="status" style={{ minHeight: 24, color: error ? '#f87171' : '#4ade80', fontSize: 14 }}>
        {error ?? (busy ? `rendering ${busy}` : results.length ? 'idle' : 'ready')}
      </div>

      {results.length > 0 && (
        <table id="results" style={{ borderCollapse: 'collapse', margin: '16px 0', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', opacity: 0.7 }}>
              <th style={{ padding: '4px 24px 4px 0' }}>tier</th>
              <th style={{ padding: '4px 24px 4px 0' }}>seconds</th>
              <th style={{ padding: '4px 24px 4px 0' }}>MB</th>
              <th style={{ padding: '4px 24px 4px 0' }}>frames</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const tier = TIERS.find((t) => t.name === r.tier);
              return (
                <tr key={r.tier}>
                  <td style={{ padding: '4px 24px 4px 0' }}>{r.tier}</td>
                  <td style={{ padding: '4px 24px 4px 0' }}>{r.seconds.toFixed(1)}</td>
                  <td style={{ padding: '4px 24px 4px 0' }}>{r.mb.toFixed(2)}</td>
                  <td style={{ padding: '4px 24px 4px 0' }}>{tier?.durationInFrames ?? '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 13, opacity: 0.7 }}>LIVE DOM (ground truth, frame {REF_FRAME})</p>
          <div style={{ width: 960, height: 540, outline: '1px solid #333' }}>
            <div style={{ width: 1920, height: 1080, transform: 'scale(0.5)', transformOrigin: 'top left' }}>
              <TestCardInner frame={REF_FRAME} />
            </div>
          </div>
        </div>

        {results.map((r) =>
          r.frameUrl ? (
            <div key={r.tier}>
              <p style={{ fontSize: 13, opacity: 0.7 }}>RENDERED — {r.tier}</p>
              <img src={r.frameUrl} width={960} style={{ outline: '1px solid #333', display: 'block' }} />
            </div>
          ) : null
        )}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
