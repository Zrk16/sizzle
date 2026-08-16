'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import mark from '../../public/mark/manifest.json';
import styles from './hero.module.css';

/**
 * The first frame: black, the mark, one line, one mono marker. Nothing else — no nav bar
 * in shot, no button, no subhead. That composition is the tell this rebuild removes.
 *
 * The mark is one generated image sliced into six letter PNGs. Trimming each slice to its
 * own bounding box is what makes per-letter animation possible and also destroys the
 * shared baseline, so every letter is placed back at the position it held in the source.
 * The manifest carries those positions; nothing here is hand-tuned.
 *
 * Coordinates normalise to the WORD's bounding box rather than the source frame, because
 * the generation has a large empty margin and laying out against the raw image would leave
 * most of the hero as dead space.
 *
 * Letters, not video. A generated melt clip was tried here and lost: 1276x720 upscaled past
 * viewport width is visibly soft, where these slices are native 2688px.
 */

const { source, letters } = mark;

const minLeft = Math.min(...letters.map((l) => l.left));
const maxRight = Math.max(...letters.map((l) => l.left + l.widthPct));
const minTop = Math.min(...letters.map((l) => l.top));
const maxBottom = Math.max(...letters.map((l) => l.top + l.heightPct));

const wordW = maxRight - minLeft;
const wordH = maxBottom - minTop;
const aspect = (wordW * source.width) / (wordH * source.height);

const PLACED = letters.map((l) => ({
  ...l,
  x: ((l.left - minLeft) / wordW) * 100,
  y: ((l.top - minTop) / wordH) * 100,
  w: (l.widthPct / wordW) * 100,
  h: (l.heightPct / wordH) * 100,
}));

/**
 * Module scope, deliberately — NOT sessionStorage.
 *
 * The drop should play when the page is actually loaded and never again while moving
 * between scenes. A module variable is cleared by a real reload and survives client-side
 * navigation, which is exactly that rule. sessionStorage would also suppress it on reload,
 * which is the opposite of what it is for.
 */
let hasDropped = false;

export function Hero({ children }: { children?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      const glyphs = gsap.utils.toArray<HTMLElement>(`.${styles.letter}`);

      if (hasDropped || reduced) {
        gsap.set(glyphs, { yPercent: 0, opacity: 1, rotate: 0 });
        return;
      }
      hasDropped = true;

      gsap.set(glyphs, { yPercent: -280, opacity: 0, rotate: (i) => (i % 2 ? 3.5 : -3.5) });

      gsap
        .timeline({ defaults: { ease: 'power3.in' } })
        // Heavy on the way in: power3.in accelerates like something with mass.
        .to(glyphs, { yPercent: 0, opacity: 1, rotate: 0, duration: 0.58, stagger: 0.07 })
        // Squash on impact, then release. A single eased tween in both directions reads as
        // a slide; the squash is what makes the metal feel heavy.
        .to(glyphs, { scaleY: 0.9, scaleX: 1.06, duration: 0.08, stagger: 0.07, ease: 'power2.out' }, '<')
        .to(
          glyphs,
          { scaleY: 1, scaleX: 1, duration: 0.9, stagger: 0.07, ease: 'elastic.out(1, 0.45)' },
          '>-0.02'
        );
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <header className={styles.hero} ref={root}>
      <p className={`index ${styles.corner}`}>01 — THE MARK</p>

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

      <p className={`display ${styles.line}`}>
        We make <span className="hot">trailers</span> for code.
      </p>

      {children}
    </header>
  );
}
