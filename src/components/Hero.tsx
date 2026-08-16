'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './hero.module.css';

/**
 * The first frame: total black, six gold letters oversized to the point that the outer two
 * are cropped by the viewport, one mono line in the corner. No nav bar, no button, no
 * subhead — that composition is the tell the whole rebuild exists to remove.
 *
 * The mark MELTS rather than falls. Earlier passes tried per-letter physics on sliced PNGs
 * with CSS drips underneath, and the drips read as detached pills because a goo filter
 * cannot fuse shapes that are not genuinely overlapping at that scale. Generating the
 * melt gives real liquid behaviour — necking, surface tension, drips of different lengths
 * running at different speeds — that no amount of CSS was going to reach.
 *
 * It plays ONCE and holds on the melted frame. The clip runs clean-to-molten, so looping
 * it would snap the gold back to solid; holding means the mark stays melted for as long as
 * you look at it. That also makes the entrance play on load and never on client-side
 * navigation, without any state to track.
 */
export function Hero({ children }: { children?: React.ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = video.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Hold the fully melted frame instead of animating into it.
      el.currentTime = el.duration || 4.9;
      setReady(true);
      return;
    }

    // Freeze on the last frame rather than looping back to solid gold.
    const hold = () => {
      el.pause();
      el.currentTime = Math.max(0, (el.duration || 5) - 0.05);
    };
    el.addEventListener('ended', hold);
    el.play().catch(() => setReady(true)); // autoplay refused: the poster still reads
    return () => el.removeEventListener('ended', hold);
  }, []);

  return (
    <header className={styles.hero}>
      <p className={`index ${styles.corner}`}>01 — THE MARK</p>

      <h1 className={styles.wordmark}>
        <span className={styles.visually}>sizzle</span>
        <video
          ref={video}
          className={styles.mark}
          src="/mark/sizzle-drip.mp4"
          poster="/mark/sizzle-poster.jpg"
          muted
          playsInline
          preload="auto"
          aria-hidden
          onLoadedData={() => setReady(true)}
          data-ready={ready}
        />
      </h1>

      <p className={`display ${styles.line}`}>
        We make <span className="hot">trailers</span> for code.
      </p>

      {children}
    </header>
  );
}
