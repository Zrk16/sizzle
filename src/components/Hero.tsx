'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './hero.module.css';

/**
 * The wordmark drop.
 *
 * Letters are separate elements so each can fall on its own beat. Right now each one is
 * live Bodoni filled with the gold gradient; when the generated wordmark is sliced, the
 * glyph inside each span is swapped for its slice and the choreography below does not
 * change at all.
 *
 * The fall is heavy on the way in and slow on the settle — `power3.in` accelerates like
 * something with weight, and the overshoot afterwards is what sells the mass. A single
 * eased tween in both directions reads like a slide, not a drop.
 */
const LETTERS = ['S', 'I', 'Z', 'Z', 'L', 'E'];

export function Hero({ children }: { children?: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const scope = root.current;
    if (!scope) return;

    const ctx = gsap.context(() => {
      const letters = gsap.utils.toArray<HTMLElement>(`.${styles.letter}`);
      const drips = gsap.utils.toArray<HTMLElement>(`.${styles.drip}`);

      gsap.set(letters, { yPercent: -140, opacity: 0, rotate: (i) => (i % 2 ? 5 : -5) });
      gsap.set(drips, { scaleY: 0, opacity: 0 });

      const tl = gsap.timeline({ defaults: { ease: 'power3.in' } });

      tl.to(letters, {
        yPercent: 0,
        opacity: 1,
        rotate: 0,
        duration: 0.62,
        stagger: 0.075,
      })
        // The settle. Squash on impact, then release — this is the beat that makes the
        // letters feel like metal rather than like divs sliding into place.
        .to(
          letters,
          { scaleY: 0.9, scaleX: 1.06, duration: 0.09, stagger: 0.075, ease: 'power2.out' },
          '<'
        )
        .to(
          letters,
          { scaleY: 1, scaleX: 1, duration: 0.85, stagger: 0.075, ease: 'elastic.out(1, 0.4)' },
          '>-0.02'
        )
        // Molten gold runs off the baseline once the metal has landed.
        .to(
          drips,
          { scaleY: 1, opacity: 1, duration: 0.7, stagger: 0.11, ease: 'power2.in' },
          '-=0.55'
        )
        .to(drips, { opacity: 0, duration: 1.1, stagger: 0.11, ease: 'power1.out' }, '>-0.25');
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <header className={styles.hero} ref={root}>
      <p className={`slug ${styles.slugTop}`}>Scene 01 — Screening</p>

      <h1 className={styles.wordmark} aria-label="sizzle">
        {LETTERS.map((char, i) => (
          <span className={styles.letterWrap} key={`${char}-${i}`} aria-hidden>
            <span className={`award ${styles.letter}`}>{char}</span>
            <span className={styles.drip} />
          </span>
        ))}
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
