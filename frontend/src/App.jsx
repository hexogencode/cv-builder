import { useEffect, useRef, useState } from 'react';
import { sendTurn, resetMock, MOCK } from './api.js';
import Chat from './components/Chat.jsx';
import CvPreview from './components/CvPreview.jsx';

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cv, messages, status }));
    } catch {
      /* storage unavailable: fine, state just won't persist */
    }
  }, [cv, messages, status]);

  async function turn(userMessage) {
    setLoading(true);
    setError(null);
    const history = userMessage ? [...messages, { role: 'user', text: userMessage }] : messages;
    if (userMessage) setMessages(history);
    try {
      // history already contains userMessage; send the messages *before* it as context
      const data = await sendTurn({ cv, messages: userMessage ? messages : [], userMessage });
      setCv(data.cv ?? {});
      setStatus({ missing_fields: data.missing_fields ?? [], ready: Boolean(data.ready) });
      setMessages([...history, { role: 'assistant', text: data.reply }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
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
    started.current = false;
    setTimeout(() => turn(''), 0);
  }

  return (
    <div className="app">
      <section className="pane chat-pane">
        <header className="pane-header">
          <h1>CV Builder</h1>
          <div className="header-actions">
            {MOCK && <span className="badge">mock mode</span>}
            <button className="ghost" onClick={restart}>Start over</button>
          </div>
        </header>
        <Chat messages={messages} loading={loading} error={error} onSend={turn} />
      </section>

      <section className="pane preview-pane">
        <header className="pane-header">
          <span className={status.ready ? 'status ready' : 'status'}>
            {status.ready
              ? 'CV ready'
              : status.missing_fields.length
                ? `Missing: ${status.missing_fields.join(', ')}`
                : 'Collecting info…'}
          </span>
          <button onClick={() => window.print()} disabled={!Object.keys(cv).length}>
            Save as PDF
          </button>
        </header>
        <CvPreview cv={cv} />
      </section>
    </div>
  );
}
