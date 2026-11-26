// Small UI extras: theme toggle, progress bar, confetti. Pure presentation.
import { useEffect, useRef, useState } from 'react';

const THEME_KEY = 'cv-builder-theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark';
  return (
    <button className="theme-toggle" onClick={onToggle} title={dark ? 'Light mode' : 'Dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <span key={theme}>{dark ? '☀️' : '🌙'}</span>
    </button>
  );
}

// 4 required items in the skeleton: name, email, education|experience, skills.
const REQUIRED = 4;

export function Progress({ missing, ready, started }) {
  const total = Math.max(REQUIRED, missing.length);
  const pct = ready ? 100 : started ? Math.round(((total - missing.length) / total) * 100) : 0;
  const label = ready
    ? '✨ CV ready'
    : !started
      ? 'Collecting info…'
      : missing.length
        ? `${pct}% · missing ${missing.map((f) => f.split('.').pop().replace('|', ' or ').replace('_', ' ')).join(', ')}`
        : `${pct}%`;
  return (
    <div className="progress">
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className={ready ? 'progress-label ready' : 'progress-label'} title={label}>{label}</span>
    </div>
  );
}

const COLORS = ['#4fcfa3', '#7c8cff', '#ffcf5c', '#ff7aa2', '#2f5d50', '#5ad1ff'];

export function Confetti({ fire }) {
  const [pieces, setPieces] = useState([]);
  useEffect(() => {
    if (!fire) return;
    setPieces(Array.from({ length: 70 }, (_, i) => ({
      id: `${fire}-${i}`,
      left: Math.random() * 100,
      color: COLORS[i % COLORS.length],
      x: `${(Math.random() - 0.5) * 40}vw`,
      r: `${(Math.random() - 0.5) * 1440}deg`,
      d: `${1.8 + Math.random() * 1.6}s`,
      delay: `${Math.random() * 0.4}s`,
    })));
    const t = setTimeout(() => setPieces([]), 4000);
    return () => clearTimeout(t);
  }, [fire]);
  if (!pieces.length) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <i key={p.id} style={{ left: `${p.left}%`, background: p.color, '--x': p.x, '--r': p.r, '--d': p.d, '--delay': p.delay }} />
      ))}
    </div>
  );
}

// ---------- Photo (stays in the browser; never sent to Gemini) ----------
export const PHOTO_KEY = 'cv-builder-photo';

// Shrink to a small JPEG so it fits in localStorage and prints sharp enough.
function resizeImage(file, max = 420) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = URL.createObjectURL(file);
  });
}

export function PhotoButton({ photo, onChange }) {
  const input = useRef(null);
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please choose an image file.');
    try { onChange(await resizeImage(file)); } catch (err) { alert(err.message); }
  }
  return (
    <>
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
      {photo ? (
        <span className="photo-ctl">
          <button className="ghost" onClick={() => input.current.click()} title="Change photo">
            <img src={photo} alt="" className="photo-thumb" /> Change
          </button>
          <button className="ghost icon" onClick={() => onChange(null)} title="Remove photo" aria-label="Remove photo">✕</button>
        </span>
      ) : (
        <button className="ghost" onClick={() => input.current.click()}>📷 Photo</button>
      )}
    </>
  );
}

// ---------- Gemini hints: one-click requests that go through the normal chat turn ----------
export function hintActions(cv) {
  const de = cv.meta?.cv_language === 'de';
  return [
    { label: '🔍 Review my CV', text: 'Review my CV like a strict recruiter. Give me the 3 most important improvements as a short numbered list. Do not change the CV yet.' },
    { label: '✅ Apply your hints', text: 'Apply the improvements you just suggested to the CV. Only use facts I already gave you; if something needs info you do not have, ask me for it.' },
    { label: '💪 Stronger bullets', text: 'Rewrite my bullet points to be stronger and more specific: strong verb, tool/tech, result. Only use facts I already gave you.' },
    { label: '✂️ Shorter', text: 'Make the CV more concise so it fits on one page. Keep all required info.' },
    de
      ? { label: '🇬🇧 English', text: 'Switch the CV to English: set meta.cv_language to "en" and translate all CV content.' }
      : { label: '🇩🇪 Deutsch', text: 'Switch the CV to German: set meta.cv_language to "de" and translate all CV content into German.' },
  ];
}
