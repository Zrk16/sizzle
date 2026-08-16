import styles from '../page.module.css';

/**
 * Scene 04 — About. Written as production notes rather than an about page, because the
 * interesting part of this project is what it measures, not who made it.
 */

const CREDITS = [
  { role: 'Directed by', name: 'Gemini 3.1 Flash Lite', note: 'shot kinds, tone order, every line on screen' },
  { role: 'Cut in', name: 'Your browser', note: '@remotion/web-renderer — no render server exists' },
  { role: 'Judged by', name: 'A measured gate', note: 'luminance, coverage, cut visibility, motion, freeze' },
  { role: 'Written from', name: 'Your commit log', note: 'real subjects, real source, never paraphrased' },
];

export default function About() {
  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <p className="slug">Scene 04 — About</p>
        <h1 className={`award ${styles.pageTitle}`}>Production notes</h1>
      </header>

      <hr className="sceneRule" />

      <div className={styles.prose}>
        <h2 className={styles.h2}>Why this exists</h2>
        <p>
          A README does not sell your work. It explains it, badly, to someone who already
          decided to care. Everything else on the internet gets a trailer; software gets a
          wall of grey text and a badge that says the build is passing.
        </p>
        <p>
          A sizzle reel is the short cut that plays when a nominee is announced. This makes
          one for a repo, out of what the repo actually contains — the commit subjects
          somebody typed at midnight, the source they wrote, the languages they reached for.
          Nothing invented, because invented detail is exactly what makes generated work
          smell generated.
        </p>

        <h2 className={styles.h2}>The AI directs, it does not decorate</h2>
        <p>
          The model chooses which shots the film is made of, which ground each stands on,
          and what goes on screen. It does not choose timing, camera travel or easing —
          those come from constants measured against real reference films. A model having
          an off day can write a weak line; it cannot break the motion.
        </p>
        <p>
          Then the film is rendered, measured, and handed back to the model with its own
          scorecard. Asking a model for JSON and hoping measured zero valid responses out of
          three. Enforcing a schema and feeding failures back as a correction turn measured
          three out of three.
        </p>

        <h2 className={styles.h2}>It renders on your machine</h2>
        <p>
          There is no render server and no queue. The video is encoded in your browser via
          WebCodecs, which is why the runtime setting is free to offer — a longer render
          costs you seconds on your own GPU and costs this site nothing at all. It also
          means it scales to any number of people, because every visitor brings a GPU.
        </p>
      </div>

      <hr className="sceneRule" />

      <ul className={styles.roll}>
        {CREDITS.map((credit, i) => (
          <li key={credit.role} className={styles.rollRow}>
            <span className={styles.rollN}>{String(i + 1).padStart(2, '0')}</span>
            <div className={styles.rollBody}>
              <p className="slug">{credit.role}</p>
              <h2 className={styles.rollTitle}>{credit.name}</h2>
              <p className={styles.rollLine}>{credit.note}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.footnote}>
        Built by Ziyaad Khursheed for the Pixel Forge AI Hackathon, 2026. Open source under
        MIT — the measurements, the failures and the notes explaining both are all in the
        repository.
      </p>
    </main>
  );
}
