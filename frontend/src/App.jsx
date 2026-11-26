import { useEffect, useRef, useState } from 'react';
import { sendTurn, resetMock, MOCK } from './api.js';
import Chat from './components/Chat.jsx';
import CvPreview from './components/CvPreview.jsx';
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
  const started = useRef(false);
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

  // Opening question on first load
  useEffect(() => {
    if (started.current || messages.length) return;
    started.current = true;
    turn('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function restart() {
    if (!confirm('Start over? This clears the current CV.')) return;
    resetMock();
    setCv({});
    setMessages([]);
    setStatus({ missing_fields: [], ready: false });
    setError(null);
    session.current += 1;
    setEdit(false);
    setReviewed(false);
    setPhoto(null);
    turn('', { base: { cv: {}, messages: [] } });
  }

  return (
    <div className="app">
      <section className="pane chat-pane">
        <header className="pane-header">
          <div className="brand">
            <h1>CV Builder</h1>
            <span className="chip">✦ Gemini</span>
          </div>
          <div className="header-actions">
            {MOCK && <span className="badge">mock</span>}
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
        {edit && <div className="edit-banner">Click any text on the CV to fix it · Enter to save · Esc to cancel · empty a bullet to delete it</div>}
        <CvPreview cv={cv} photo={photo} edit={edit} onChange={setCv} />
      </section>
      <Confetti fire={celebrate} />
    </div>
  );
}
