'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import styles from './drip.module.css';

/**
 * A drop of molten gold, forming and falling.
 *
 * The whole cycle in four beats, which is what real liquid does:
 *   swell   — a bead grows at the anchor, held by surface tension
 *   neck    — it stretches downward, the connection thins
 *   snap    — it detaches and the remainder springs back up
 *   fall    — the freed drop accelerates away under gravity
 *
 * The bead and the anchor are two separate circles sharing the goo filter, which is the
 * entire trick: while they overlap the filter fuses them into one surface, and as the
 * bead pulls clear the fused neck thins and breaks on its own. Animating a teardrop shape
 * would have to fake that; this gets it for free from the filter.
 *
 * Gravity is real: `power2.in` on the fall is acceleration, and the drop that has fallen
 * furthest is also the fastest, so a column of drips never reads as a metronome.
 */
export function Drip({
  delay = 0,
  distance = 260,
  scale = 1,
  className,
}: {
  delay?: number;
  /** How far the freed drop travels before fading, in px. */
  distance?: number;
  scale?: number;
  className?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const scope = root.current;
    if (!scope) return;

    const ctx = gsap.context(() => {
      const bead = scope.querySelector<HTMLElement>(`.${styles.bead}`);
      const anchor = scope.querySelector<HTMLElement>(`.${styles.anchor}`);
      if (!bead || !anchor) return;

      const cycle = () => {
        gsap.set(bead, { y: 0, scaleX: 1, scaleY: 1, opacity: 1 });
        gsap.set(anchor, { scaleY: 1 });

        return gsap
          .timeline({
            // Random hold between drops so a row of them never syncs up.
            repeatDelay: 1.4 + Math.random() * 3.2,
            repeat: -1,
          })
          // swell — the bead fills while surface tension still holds it
          .fromTo(
            bead,
            { y: 0, scaleX: 0.35, scaleY: 0.35, opacity: 0 },
            { scaleX: 1, scaleY: 1, opacity: 1, duration: 0.7, ease: 'power2.out' }
          )
          // neck — it sags and thins; the anchor stretches after it
          .to(bead, { y: 16 * scale, scaleX: 0.82, scaleY: 1.35, duration: 0.55, ease: 'power2.in' })
          .to(anchor, { scaleY: 1.6, duration: 0.55, ease: 'power2.in' }, '<')
          // snap — the anchor springs back the instant the neck breaks
          .to(anchor, { scaleY: 1, duration: 0.45, ease: 'elastic.out(1, 0.35)' })
          // fall — acceleration, stretched by its own speed, gone before it lands
          .to(
            bead,
            { y: distance, scaleX: 0.6, scaleY: 1.7, duration: 0.85, ease: 'power2.in' },
            '<'
          )
          .to(bead, { opacity: 0, duration: 0.3, ease: 'power1.in' }, '>-0.3');
      };

      gsap.delayedCall(delay, cycle);
    }, root);

    return () => ctx.revert();
  }, [delay, distance, scale]);

  return (
    <span
      ref={root}
      className={className ? `${styles.drip} ${className}` : styles.drip}
      style={{ '--drip-scale': scale } as React.CSSProperties}
      aria-hidden
    >
      <span className={styles.anchor} />
      <span className={styles.bead} />
    </span>
  );
}
