'use client';

/**
 * The goo filter.
 *
 * Blur, then crush the alpha channel back to a hard edge. Two blurred shapes that overlap
 * merge into one surface, and a shape pulling away from another necks and snaps like real
 * liquid. This is what makes a drip read as molten gold rather than as a rectangle
 * sliding downward — nothing else in CSS produces surface tension.
 *
 * Mounted once at the root; every drip on the site references it by id.
 */
export function Goo() {
  return (
    <svg
      aria-hidden
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          {/* The last row is the contrast crush: multiply alpha hard, then subtract, so
              the blurred falloff snaps back into a defined edge. */}
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>

        {/* Thinner variant for the small drips that run down the page. */}
        <filter id="goo-fine">
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
    </svg>
  );
}
