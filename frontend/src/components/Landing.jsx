// Start page: one line on what it does + two ways in. `hasCv` adds a "continue" link.
import { useRef } from 'react';

export default function Landing({ onScratch, onUpload, onContinue, hasCv, importing, error, themeToggle, onHome }) {
  const input = useRef(null);

  function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onUpload(file);
  }

  return (
    <main className="landing">
      <div className="landing-top">
        <button className="brand logo" onClick={onHome} title="Home"><h1>CV Builder</h1></button>
        {themeToggle}
      </div>

      <section className="hero">
        <h2>Your CV, built by an AI interviewer.</h2>
        <p>Answer a few questions. Gemini writes the CV.</p>

        <div className="cta">
          <button className="primary" onClick={onScratch} disabled={importing}>Create from scratch</button>
          <button className="ghost" onClick={() => input.current.click()} disabled={importing}>
            {importing ? <><span className="spinner small" /> Reading your CV…</> : 'Upload CV (PDF)'}
          </button>
          <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={pick} />
        </div>

        {hasCv && !importing && (
          <button className="link" onClick={onContinue}>Continue your CV →</button>
        )}
        {error && <p className="landing-error">{error}</p>}
      </section>
    </main>
  );
}
