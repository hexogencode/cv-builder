// Look-and-layout controls for the CV (frontend-only, saved in localStorage, never sent to Gemini).
import { useEffect, useState } from 'react';

export const FONTS = {
  classic: { label: 'Classic', css: "Georgia, 'Times New Roman', serif" },
  modern: { label: 'Modern', css: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  elegant: { label: 'Elegant', css: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  clean: { label: 'Clean', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
};
export const ACCENTS = ['#2f5d50', '#1f4e79', '#8b2c2c', '#6a4c93', '#b5651d', '#333333'];
export const SIZES = { 0.92: 'Compact', 1: 'Normal', 1.08: 'Large' };
export const DEFAULT_ORDER = ['profile', 'experience', 'education', 'projects', 'skills', 'languages'];
const DEFAULT_DESIGN = { font: 'classic', accent: ACCENTS[0], size: 1, order: DEFAULT_ORDER, photoSide: 'right' };
const KEY = 'cv-builder-design';

export function useDesign() {
  const [design, setDesign] = useState(() => {
    try { return { ...DEFAULT_DESIGN, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return DEFAULT_DESIGN; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(design)); } catch { /* ignore */ }
  }, [design]);
  const update = (patch) => setDesign((d) => ({ ...d, ...patch }));
  const reset = () => setDesign(DEFAULT_DESIGN);
  return [design, update, reset];
}

export function designStyle(design) {
  return {
    '--cv-font': FONTS[design.font]?.css ?? FONTS.classic.css,
    '--cv-accent': design.accent,
    '--cv-scale': design.size,
  };
}

export default function DesignBar({ design, onChange, onReset }) {
  return (
    <div className="design-bar">
      <label>
        Font
        <select value={design.font} onChange={(e) => onChange({ font: e.target.value })}>
          {Object.entries(FONTS).map(([k, f]) => (
            <option key={k} value={k} style={{ fontFamily: f.css }}>{f.label}</option>
          ))}
        </select>
      </label>

      <div className="seg" role="group" aria-label="Text size">
        {Object.entries(SIZES).map(([v, label]) => (
          <button key={v} className={Number(v) === design.size ? 'on' : ''} onClick={() => onChange({ size: Number(v) })}>
            {label}
          </button>
        ))}
      </div>

      <div className="swatches" role="group" aria-label="Accent colour">
        {ACCENTS.map((c) => (
          <button key={c} className={c === design.accent ? 'swatch on' : 'swatch'} style={{ background: c }}
            onClick={() => onChange({ accent: c })} aria-label={`Accent ${c}`} />
        ))}
        <input type="color" value={design.accent} onChange={(e) => onChange({ accent: e.target.value })} title="Custom colour" />
      </div>

      <button className="ghost small" onClick={() => onChange({ photoSide: design.photoSide === 'left' ? 'right' : 'left' })}
        title="Photo side">
        Photo {design.photoSide === 'left' ? '◧ left' : 'right ◨'}
      </button>
      <button className="ghost small" onClick={onReset}>Reset look</button>
      <p className="design-tip">Click text to edit · drag ⠿ or use ↑↓ to move sections and entries · ✕ removes an entry</p>
    </div>
  );
}
