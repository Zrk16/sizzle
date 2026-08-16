import Link from 'next/link';
import styles from '../page.module.css';

/**
 * Scene 02 — the reels already screened.
 *
 * The public gallery is opt-in and needs a store behind it, which does not exist yet.
 * Until it does this page is honest about that rather than faking rows: it shows the
 * films anyone can reproduce in one click, because a library with three real entries
 * beats a grid of placeholder cards.
 */

const SCREENED = [
  {
    repo: 'darkroomengineering/lenis',
    name: 'lenis',
    line: 'Why does web scroll feel broken?',
    detail: '1,072 commits · 32 contributors · TypeScript',
  },
  {
    repo: 'pallets/flask',
    name: 'flask',
    line: 'What if code stayed this simple?',
    detail: '5,555 commits · 401 contributors · Python',
  },
  {
    repo: 'sindresorhus/slugify',
    name: 'slugify',
    line: 'Is your URL path a readable mess?',
    detail: '71 commits · 17 contributors · JavaScript',
  },
];

export default function Library() {
  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <p className="slug">Scene 02 / Library</p>
        <h1 className={`display ${styles.pageTitle}`}>Previously screened</h1>
        <p className={styles.lede}>
          Every reel is cut from a repo&rsquo;s own commits and its own source. No two
          nominees get the same film, because no two nominees have the same history.
        </p>
      </header>

      <hr className="sceneRule" />

      <ul className={styles.roll}>
        {SCREENED.map((entry, i) => (
          <li key={entry.repo} className={styles.rollRow}>
            <span className={styles.rollN}>{String(i + 1).padStart(2, '0')}</span>
            <div className={styles.rollBody}>
              <h2 className={styles.rollTitle}>{entry.name}</h2>
              <p className={styles.rollLine}>&ldquo;{entry.line}&rdquo;</p>
              <p className="slug">{entry.detail}</p>
            </div>
            <Link href="/" className={styles.rollAction}>
              Screen it
            </Link>
          </li>
        ))}
      </ul>

      <p className={styles.footnote}>
        A public, opt-in gallery of everyone&rsquo;s reels is next. Until it exists, this page
        says so instead of showing empty cards.
      </p>
    </main>
  );
}
