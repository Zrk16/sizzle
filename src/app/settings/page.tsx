'use client';

import { useEffect, useState } from 'react';
import styles from '../page.module.css';

/**
 * Scene 03 — Settings.
 *
 * There are no accounts, so everything here lives in localStorage and is honest about it.
 * A bring-your-own key field is included because the hosted key is rate-limited and a
 * heavy user should be able to opt out of the queue rather than be throttled by it.
 */

type Prefs = {
  aspect: '16:9' | '9:16' | '1:1';
  effort: 'fast' | 'balanced' | 'cinematic';
  reducedMotion: boolean;
  ownKey: string;
};

const DEFAULTS: Prefs = { aspect: '16:9', effort: 'balanced', reducedMotion: false, ownKey: '' };
const STORAGE_KEY = 'sizzle:prefs';

const ASPECTS: { id: Prefs['aspect']; label: string }[] = [
  { id: '16:9', label: '16:9 — landscape' },
  { id: '9:16', label: '9:16 — vertical' },
  { id: '1:1', label: '1:1 — square' },
];

const EFFORTS: { id: Prefs['effort']; label: string }[] = [
  { id: 'fast', label: 'Fast' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'cinematic', label: 'Cinematic' },
];

export default function Settings() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      // A corrupt blob in storage should not take the page down with it.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 1600);
    return () => clearTimeout(t);
  }, [prefs, loaded]);

  const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  return (
    <main className={styles.page}>
      <header className={styles.pageHead}>
        <p className="slug">Scene 03 — Settings</p>
        <h1 className={`display ${styles.pageTitle}`}>House rules</h1>
        <p className={styles.lede}>
          Stored in this browser only. There are no accounts, nothing is sent anywhere, and
          clearing your site data resets all of it.
        </p>
      </header>

      <div className={styles.fields}>
        <div className={styles.field}>
          <div className={styles.fieldLabel}>
            <p className="slug">Frame</p>
            {saved && <span className={styles.saved}>Saved</span>}
          </div>
          <p className={styles.fieldHint}>
            One spec renders at any shape — the film is authored against a fixed logical
            canvas and scaled to whatever frame you pick.
          </p>
          <div className={styles.choices}>
            {ASPECTS.map((a) => (
              <button
                key={a.id}
                onClick={() => set('aspect', a.id)}
                className={prefs.aspect === a.id ? `${styles.choice} ${styles.choiceOn}` : styles.choice}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <p className="slug">Default runtime</p>
          <p className={styles.fieldHint}>
            Longer holds mean a longer render — and the render happens on your machine, not
            ours, which is why the choice is free to offer.
          </p>
          <div className={styles.choices}>
            {EFFORTS.map((e) => (
              <button
                key={e.id}
                onClick={() => set('effort', e.id)}
                className={prefs.effort === e.id ? `${styles.choice} ${styles.choiceOn}` : styles.choice}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <p className="slug">Motion</p>
          <p className={styles.fieldHint}>
            Turns off the wordmark drop and smooth scrolling. Your OS setting is respected
            automatically; this is an override for this browser.
          </p>
          <div className={styles.choices}>
            <button
              onClick={() => set('reducedMotion', false)}
              className={!prefs.reducedMotion ? `${styles.choice} ${styles.choiceOn}` : styles.choice}
            >
              Full
            </button>
            <button
              onClick={() => set('reducedMotion', true)}
              className={prefs.reducedMotion ? `${styles.choice} ${styles.choiceOn}` : styles.choice}
            >
              Reduced
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <p className="slug">Your own Gemini key</p>
          <p className={styles.fieldHint}>
            Optional. The shared key is rate-limited across everyone using the site; your
            own key skips that queue. It is kept in this browser and never stored on a
            server.
          </p>
          <input
            type="password"
            value={prefs.ownKey}
            onChange={(e) => set('ownKey', e.target.value)}
            placeholder="leave empty to use the shared key"
            className={styles.textInput}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>
    </main>
  );
}
