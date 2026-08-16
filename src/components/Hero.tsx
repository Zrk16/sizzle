'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import mark from '../../public/mark/manifest.json';
import styles from './hero.module.css';

/**
 * The wordmark drop.
 *
 * The mark is one generated image sliced into six letter PNGs. Each slice is trimmed to
 * its own bounding box, which is what makes per-letter animation possible — but trimming
 * also destroys the shared baseline, so every letter is placed back using the position it
 * held in the source. The manifest carries those positions; nothing here is hand-tuned.
 *
 * Coordinates are normalised to the WORD's bounding box rather than the source image,
 * because the generation has a large empty margin and laying out against the raw frame
 * would leave most of the hero as dead space.
 *
 * The fall is heavy in and slow to settle: `power3.in` accelerates like something with
 * mass, then a squash on impact and an elastic release. A single eased tween in both
 * directions reads as a slide, not a drop. The molten drips are baked into the slices, so
 * they arrive with the metal instead of being animated separately.
 */

const { source, letters } = mark;

const minLeft = Math.min(...letters.map((l) => l.left));
const maxRight = Math.max(...letters.map((l) => l.left + l.widthPct));
const minTop = Math.min(...letters.map((l) => l.top));
const maxBottom = Math.max(...letters.map((l) => l.top + l.heightPct));

const wordW = maxRight - minLeft;
const wordH = maxBottom - minTop;
const aspect = (wordW * source.width) / (wordH * source.height);

/** Each letter, positioned as a percentage of the word's own box. */
const PLACED = letters.map((l) => ({
  ...l,
  x: ((l.left - minLeft) / wordW) * 100,
  y: ((l.top - minTop) / wordH) * 100,
  w: (l.widthPct / wordW) * 100,
  h: (l.heightPct / wordH) * 100,
}));

export function Hero({ children }: { children?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const scope = root.current;
    if (!scope) return;

    const ctx = gsap.context(() => {
      const glyphs = gsap.utils.toArray<HTMLElement>(`.${styles.letter}`);
      gsap.set(glyphs, { yPercent: -260, opacity: 0, rotate: (i) => (i % 2 ? 4 : -4) });

      gsap
        .timeline({ defaults: { ease: 'power3.in' } })
        .to(glyphs, { yPercent: 0, opacity: 1, rotate: 0, duration: 0.6, stagger: 0.08 })
        .to(
          glyphs,
          { scaleY: 0.9, scaleX: 1.07, duration: 0.09, stagger: 0.08, ease: 'power2.out' },
          '<'
        )
        .to(
          glyphs,
          { scaleY: 1, scaleX: 1, duration: 0.9, stagger: 0.08, ease: 'elastic.out(1, 0.42)' },
          '>-0.02'
        );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <header className={styles.hero} ref={root}>
      <p className={`slug ${styles.slugTop}`}>Scene 01 — Screening</p>

      <h1 className={styles.wordmark} aria-label="sizzle">
        <span className={styles.word} style={{ aspectRatio: String(aspect) }}>
          {PLACED.map((l, i) => (
            <span
              key={`${l.char}-${i}`}
              className={styles.letterWrap}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` }}
              aria-hidden
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={l.src}
                alt=""
                width={l.width}
                height={l.height}
                className={styles.letter}
                decoding="async"
                fetchPriority={i < 3 ? 'high' : 'auto'}
              />
            </span>
          ))}
        </span>
      </h1>

      <p className={styles.tagline}>
        A sizzle reel is what plays when a nominee is announced.
        <br />
        Paste a repo. It becomes the nominee.
      </p>

      {children}
    </header>
  );
}
