'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import mark from '../../public/mark/manifest.json';
import { Drip } from './Drip';
import styles from './hero.module.css';

/**
 * The wordmark drop.
 *
 * One generated image sliced into six letter PNGs. Trimming each slice to its own box is
 * what makes per-letter animation possible and also destroys the shared baseline, so every
 * letter is placed back at the position it held in the source. The manifest carries those
 * positions; nothing here is hand-tuned.
 *
 * Coordinates are normalised to the WORD's bounding box rather than the source frame,
 * because the generation has a large empty margin and laying out against the raw image
 * would leave most of the hero as dead space.
 *
 * The drips are NOT in the image. Baked-in drips are a picture of liquid; these are two
 * goo-filtered circles that swell, neck, snap and fall on their own clocks, so the mark is
 * still melting while you look at it.
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
 * The drop should play when the page is actually loaded and never again while the visitor
 * moves between scenes. A module variable is reset by a real reload and survives every
 * client-side navigation, which is exactly that rule. sessionStorage would also suppress
 * it on reload, which is the opposite of what it is for.
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

      gsap.set(glyphs, { yPercent: -260, opacity: 0, rotate: (i) => (i % 2 ? 4 : -4) });

      gsap
        .timeline({ defaults: { ease: 'power3.in' } })
        .to(glyphs, { yPercent: 0, opacity: 1, rotate: 0, duration: 0.6, stagger: 0.08 })
        // Squash on impact, then release. A single eased tween in both directions reads as
        // a slide; the squash is what gives the metal mass.
        .to(glyphs, { scaleY: 0.9, scaleX: 1.07, duration: 0.09, stagger: 0.08, ease: 'power2.out' }, '<')
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
      <h1 className={styles.wordmark} aria-label="sizzle">
        <span className={styles.word} style={{ aspectRatio: String(aspect) }}>
          {PLACED.map((l, i) => (
            <span
              key={`${l.char}-${i}`}
              className={styles.letterWrap}
              style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.w}%`, height: `${l.h}%` }}
              aria-hidden
            >
              {/* Drip first in DOM so it sits behind the metal it runs off. */}
              <Drip
                delay={1.1 + i * 0.34}
                distance={220 + ((i * 47) % 130)}
                scale={l.char === 'I' ? 0.72 : 1}
              />
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

      <p className={styles.tagline}>We make trailers for code.</p>

      {children}
    </header>
  );
}
