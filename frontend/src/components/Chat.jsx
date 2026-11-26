import { useEffect, useRef, useState } from 'react';

export default function Chat({ messages, loading, error, onSend, hints = [] }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Put the cursor back in the box as soon as Gemini has answered.
  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

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
          <div key={i} className={`msg ${m.role}`}>{m.display ?? m.text}</div>
        ))}
        {loading && (
          <div className="msg assistant typing" aria-label="Gemini is typing"><i /><i /><i /></div>
        )}
        {error && <div className="msg error">Error: {error}</div>}
        <div ref={endRef} />
      </div>
      {hints.length > 0 && !loading && (
        <div className="hints" aria-label="Gemini suggestions">
          {hints.map((h, i) => (
            <button key={h.label} className="hint" style={{ '--i': i }} onClick={() => onSend(h.text, h.label)}>
              {h.label}
            </button>
          ))}
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <textarea
          ref={inputRef}
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
