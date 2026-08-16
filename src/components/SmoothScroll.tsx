'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Lenis drives scrolling for the whole site. It is mounted once at the root rather than
 * per page so a route change never drops and re-creates the scroller mid-transition.
 *
 * Respects `prefers-reduced-motion`: for anyone who has asked the OS for less movement,
 * smoothed inertial scrolling is exactly the thing they turned off.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
