import { useEffect, useRef, useState } from 'react';
import { sendTurn, importCv, resetMock, MOCK } from './api.js';
import Chat from './components/Chat.jsx';
import CvPreview from './components/CvPreview.jsx';
import Landing from './components/Landing.jsx';
import DesignBar, { useDesign } from './components/DesignBar.jsx';
import { useTheme, ThemeToggle, Progress, Confetti, PhotoButton, PHOTO_KEY, hintActions } from './components/Fx.jsx';

const STORAGE_KEY = 'cv-builder-state-v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null;
  } catch {
    return null;
  }
}

export default function App() {
  const saved = useRef(load()).current;
  const [cv, setCv] = useState(saved?.cv ?? {});
  const [messages, setMessages] = useState(saved?.messages ?? []);
  const [status, setStatus] = useState(saved?.status ?? { missing_fields: [], ready: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [home, setHome] = useState(false); // logo click: show the start page without losing the CV
  const [landingError, setLandingError] = useState(null);
  const [design, updateDesign, resetDesign] = useDesign();
  const [theme, toggleTheme] = useTheme();
  const [edit, setEdit] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  // Photo lives only in this browser (own key): it's never sent to the backend/Gemini.
  const [photo, setPhoto] = useState(() => {
    try { return localStorage.getItem(PHOTO_KEY); } catch { return null; }
  });
  useEffect(() => {
    try {
      if (photo) localStorage.setItem(PHOTO_KEY, photo); else localStorage.removeItem(PHOTO_KEY);
    } catch { /* storage full or unavailable: photo just won't persist */ }
  }, [photo]);
  // Confetti only when "ready" flips false → true during this session (not on reload).
  const [celebrate, setCelebrate] = useState(0);
  const wasReady = useRef(status.ready);
  useEffect(() => {
    if (status.ready && !wasReady.current) setCelebrate((n) => n + 1);
    wasReady.current = status.ready;
  }, [status.ready]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cv, messages, status }));
    } catch {
      /* storage unavailable: fine, state just won't persist */
    }
  }, [cv, messages, status]);

  // Bumped on "Start over": answers to requests from an older session are ignored.
  const session = useRef(0);

  // `base` lets restart() pass the fresh empty state instead of this render's (stale) cv/messages.
  // `display`: shorter text to show in the chat (hint buttons send a longer instruction).
  async function turn(userMessage, { base = { cv, messages }, display } = {}) {
    const mySession = session.current;
    setLoading(true);
    setError(null);
    const userMsg = { role: 'user', text: userMessage, ...(display && { display }) };
    const history = userMessage ? [...base.messages, userMsg] : base.messages;
    if (userMessage) setMessages(history);
    try {
      // history already contains userMessage; send the messages *before* it as context
      const data = await sendTurn({ cv: base.cv, messages: userMessage ? base.messages : [], userMessage });
      if (mySession !== session.current) return;
      setCv(data.cv ?? {});
      setStatus({ missing_fields: data.missing_fields ?? [], ready: Boolean(data.ready) });
      setMessages([...history, { role: 'assistant', text: data.reply }]);
    } catch (e) {
      if (mySession === session.current) setError(e.message);
    } finally {
      if (mySession === session.current) setLoading(false);
    }
  }

  // Landing page → "Create from scratch": ask Gemini for the opening question.
  const hasCv = messages.length > 0;
  const replaceOk = () => !hasCv || confirm('This replaces your current CV. Continue?');

  function clearAll() {
    resetMock();
    setCv({});
    setMessages([]);
    setStatus({ missing_fields: [], ready: false });
    setError(null);
    session.current += 1;
    setEdit(false);
    setReviewed(false);
    setPhoto(null);
    setImporting(false);
    setLandingError(null);
  }

  function startScratch() {
    if (!replaceOk()) return;
    if (hasCv) clearAll();
    setHome(false);
    setLandingError(null);
    turn('', { base: { cv: {}, messages: [] } });
  }

  // Landing page → "I have a CV": import the PDF, then continue in the normal chat/editor.
  async function startImport(file) {
    if (!replaceOk()) return;
    if (hasCv) clearAll();
    const mySession = session.current;
    setLandingError(null);
    setImporting(true);
    try {
      const data = await importCv(file);
      if (mySession !== session.current) return;
      setCv(data.cv ?? {});
      setStatus({ missing_fields: data.missing_fields ?? [], ready: Boolean(data.ready) });
      // Keep the chat history short: the CV JSON already holds the imported content.
      setMessages([
        { role: 'user', text: `I uploaded my existing CV (${file.name}) and you filled the CV from it.`, display: `📄 Uploaded ${file.name}` },
        { role: 'assistant', text: data.reply },
      ]);
      setEdit(true);
      setHome(false);
    } catch (e) {
      if (mySession === session.current) setLandingError(e.message);
    } finally {
      if (mySession === session.current) setImporting(false);
    }
  }

  function restart() {
    if (!confirm('Start over? This clears the current CV.')) return;
    clearAll();
    setHome(false);
  }

  const themeToggle = <ThemeToggle theme={theme} onToggle={toggleTheme} />;

  if (home || (!messages.length && !loading)) {
    return (
      <>
        <Landing onScratch={startScratch} onUpload={startImport} importing={importing}
          error={landingError ?? (hasCv ? null : error)} themeToggle={themeToggle}
          hasCv={hasCv} onContinue={() => setHome(false)} onHome={() => setHome(true)} />
        {MOCK && <span className="badge mock-corner">mock mode</span>}
      </>
    );
  }

  return (
    <div className="app">
      <section className="pane chat-pane">
        <header className="pane-header">
          <button className="brand logo" onClick={() => { setEdit(false); setHome(true); }} title="Home">
            <h1>CV Builder</h1>
            <span className="chip">✦ Gemini</span>
          </button>
          <div className="header-actions">
            {MOCK && <span className="badge">mock</span>}
            {themeToggle}
            <button className="ghost" onClick={restart}>Start over</button>
          </div>
        </header>
        <Chat messages={messages} loading={loading} error={error}
          onSend={(text, label) => {
            if (label?.startsWith('🔍')) setReviewed(true);
            turn(text, label ? { display: label } : undefined);
          }}
          hints={status.ready ? hintActions(cv).filter((h) => reviewed || !h.label.startsWith('✅')) : []} />
      </section>

      <section className="pane preview-pane">
        <header className="pane-header">
          <Progress missing={status.missing_fields} ready={status.ready} started={Object.keys(cv).length > 0} />
          <div className="header-actions">
            <PhotoButton photo={photo} onChange={setPhoto} />
            <button className={edit ? 'ghost active' : 'ghost'} onClick={() => setEdit((e) => !e)}
              disabled={!Object.keys(cv).length} title="Fix text directly on the CV">
              {edit ? '✓ Done' : '✏️ Edit'}
            </button>
            <button className={status.ready ? 'pdf-btn ready' : 'pdf-btn'} onClick={() => { setEdit(false); setTimeout(() => window.print(), 50); }}
              disabled={!Object.keys(cv).length}>
              Save as PDF
            </button>
          </div>
        </header>
        {edit && <DesignBar design={design} onChange={updateDesign} onReset={resetDesign} />}
        <CvPreview cv={cv} photo={photo} edit={edit} onChange={setCv} design={design} onDesign={updateDesign} />
      </section>
      <Confetti fire={celebrate} />
    </div>
  );
}
