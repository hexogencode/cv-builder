import { useEffect, useRef, useState } from 'react';

export default function Chat({ messages, loading, error, onSend }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function submit(e) {
    e.preventDefault();
    const t = text.trim();
    if (!t || loading) return;
    setText('');
    onSend(t);
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>{m.text}</div>
        ))}
        {loading && <div className="msg assistant typing">…</div>}
        {error && <div className="msg error">Error: {error}</div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          placeholder="Answer here… (Enter to send, Shift+Enter for new line)"
          rows={2}
        />
        <button type="submit" disabled={loading || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
