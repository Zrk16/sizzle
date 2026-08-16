'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './nav.module.css';

/**
 * Nav as a slate line. Every page is a "scene" in the same document, numbered like a
 * shooting script, so navigation reads as part of the conceit instead of as a menu
 * bolted on top of it.
 */
const SCENES = [
  { href: '/', n: '01', label: 'Screening' },
  { href: '/library', n: '02', label: 'Library' },
  { href: '/settings', n: '03', label: 'Settings' },
  { href: '/about', n: '04', label: 'About' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Primary">
      <Link href="/" className={styles.mark}>
        sizzle
      </Link>

      <ul className={styles.scenes}>
        {SCENES.map((scene) => {
          const active = pathname === scene.href;
          return (
            <li key={scene.href}>
              <Link
                href={scene.href}
                className={active ? `${styles.scene} ${styles.active}` : styles.scene}
                aria-current={active ? 'page' : undefined}
              >
                <span className={styles.n}>{scene.n}</span>
                <span>{scene.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
