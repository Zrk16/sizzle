import type React from 'react';
import { scoreFilm, toFrame, type Frame, type Score } from './score';
import type { RenderSpec } from './spec';

/**
 * Runs the gate in the visitor's browser.
 *
 * Deliberately renders a small PROXY rather than the real film: the metrics are all
 * whole-frame luminance statistics, which are scale-invariant, so a 320-wide render
 * answers the same questions in a fraction of the time. Grading is meant to feel like a
 * step in the process, not like rendering the video twice.
 */

const PROXY_WIDTH = 320;
/**
 * Frames between kept samples. The metrics are whole-frame statistics and a shot runs
 * ~66 frames, so every 10 still puts six or seven samples inside each shot — enough to
 * catch a stall without keeping more pixels in memory than the measurement needs.
 */
const SAMPLE_EVERY = 10;

export type CritiqueResult = { score: Score; proxyUrl: string; ms: number };

/** Decode N evenly spaced frames out of a rendered blob. */
async function sampleFrames(url: string, spec: RenderSpec, height: number): Promise<Frame[]> {
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  video.playsInline = true;

  /**
   * The element MUST be in the document and MUST NOT be `display: none`.
   *
   * A detached or undisplayed video is never composited, and an uncomposited video never
   * presents frames — so `requestVideoFrameCallback` never fires and `drawImage` keeps
   * returning whatever was last painted. Both of those produced a gate that confidently
   * reported motion of exactly 0 on a film that plainly animates. Parked off-screen at
   * 2px so it is laid out and composited without ever being visible.
   */
  Object.assign(video.style, {
    position: 'fixed',
    left: '-4px',
    top: '-4px',
    width: '2px',
    height: '2px',
    opacity: '0.01',
    pointerEvents: 'none',
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(video);

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('could not decode the proxy render'));
    setTimeout(() => reject(new Error('proxy decode timed out')), 20_000);
  });

  const canvas = document.createElement('canvas');
  canvas.width = PROXY_WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');

  /**
   * Capture during PLAYBACK, not by seeking.
   *
   * Seek-then-draw was tried twice and is wrong here. `seeked` fires when the seek
   * completes, not when the frame is composited, so drawing on it reads the previous
   * frame; adding two animation frames after it only narrowed the race rather than
   * closing it, and the gate kept reporting motion of exactly 0 on a film that plainly
   * animates. Worse, it was inconsistent between runs — cuts scored 4/4 once and 1/6 the
   * next time on the same input, which is the signature of a race, not a measurement.
   *
   * `requestVideoFrameCallback` does not fire reliably for a seek on a paused element,
   * but it is exact during playback: it hands back each presented frame together with the
   * `mediaTime` it belongs to. Playing at 4x costs about a quarter of the film's duration
   * and every sample is guaranteed to be a distinct, real frame.
   */
  type RVFCMeta = { mediaTime: number };
  type VideoWithRVFC = HTMLVideoElement & {
    requestVideoFrameCallback: (cb: (now: number, meta: RVFCMeta) => void) => number;
  };

  const frames: Frame[] = [];
  const stride = SAMPLE_EVERY / spec.fps; // seconds between kept samples
  let nextWanted = 0;

  if (!('requestVideoFrameCallback' in video)) {
    throw new Error('This browser cannot grade video — requestVideoFrameCallback is unavailable.');
  }
  const v = video as VideoWithRVFC;

  await new Promise<void>((resolve, reject) => {
    const onFrame = (_now: number, meta: RVFCMeta) => {
      if (meta.mediaTime + 1e-6 >= nextWanted) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        frames.push(toFrame(data, canvas.width, canvas.height));
        nextWanted += stride;
      }
      if (!video.ended) v.requestVideoFrameCallback(onFrame);
    };
    video.onended = () => resolve();
    video.onerror = () => reject(new Error('the proxy render would not play back'));
    // Long enough for a 4x pass over any film we produce, short enough to fail loudly.
    setTimeout(resolve, 30_000);
    v.requestVideoFrameCallback(onFrame);
    video.playbackRate = 4;
    video.play().catch(reject);
  });

  video.pause();
  video.remove();

  // Fail loudly rather than scoring nothing and calling it a pass. Too few frames means
  // the page was not compositing (a hidden tab, or a headless browser without a display),
  // not that the film is fine.
  if (frames.length < 4) {
    throw new Error(
      `Only captured ${frames.length} frames — the page has to be visible and playing to be graded. ` +
        `Keep this tab in the foreground and try again.`
    );
  }
  return frames;
}

export async function critique(
  spec: RenderSpec,
  component: React.FC<{ spec: RenderSpec }>,
  onProgress?: (note: string) => void
): Promise<CritiqueResult> {
  const started = performance.now();
  const height = Math.round((PROXY_WIDTH * spec.height) / spec.width / 2) * 2; // keep it even

  onProgress?.('Rendering a proxy to grade…');
  const { renderMediaOnWeb } = await import('@remotion/web-renderer');
  const { getBlob } = await renderMediaOnWeb({
    licenseKey: 'free-license',
    composition: {
      component,
      defaultProps: { spec },
      durationInFrames: spec.durationInFrames,
      fps: spec.fps,
      width: PROXY_WIDTH,
      height,
      id: 'sizzle-proxy',
    },
    inputProps: { spec },
    // The proxy exists only to be measured for luminance and motion. Encoding audio for
    // it would cost time and change nothing any of the metrics look at.
    audioCodec: null,
  });

  const proxyUrl = URL.createObjectURL(await getBlob());
  onProgress?.('Measuring the cut…');
  const frames = await sampleFrames(proxyUrl, spec, height);

  return {
    score: scoreFilm(frames, spec, SAMPLE_EVERY),
    proxyUrl,
    ms: performance.now() - started,
  };
}
