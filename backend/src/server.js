import express from 'express';
import cors from 'cors';
import { runTurn, MODEL } from './gemini.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

const MAX_MESSAGES = 6;
const MAX_MESSAGE_CHARS = 4000;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: MODEL, has_key: Boolean(process.env.GEMINI_API_KEY) });
});

app.post('/api/turn', async (req, res, next) => {
  try {
    const { cv = {}, recent_messages = [], user_message = '' } = req.body ?? {};
    if (typeof cv !== 'object' || Array.isArray(cv)) return res.status(400).json({ error: 'cv must be an object' });
    if (!Array.isArray(recent_messages)) return res.status(400).json({ error: 'recent_messages must be an array' });
    if (typeof user_message !== 'string') return res.status(400).json({ error: 'user_message must be a string' });

    const result = await runTurn({
      cv,
      // Server enforces the token-saving limits even if the client doesn't.
      recentMessages: recent_messages.slice(-MAX_MESSAGES).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        text: String(m.text ?? '').slice(0, MAX_MESSAGE_CHARS),
      })),
      userMessage: user_message.slice(0, MAX_MESSAGE_CHARS),
    });

    if (result.usage?.input_tokens) {
      console.log(`[turn] in=${result.usage.input_tokens} out=${result.usage.output_tokens} ready=${result.ready}`);
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Planned features: see shared/api.md
app.post('/api/import', (_req, res) => res.status(501).json({ error: 'not implemented yet' }));
app.post('/api/tailor', (_req, res) => res.status(501).json({ error: 'not implemented yet' }));

app.use((err, _req, res, _next) => {
  console.error('[error]', err.message, err.raw ? `\nraw: ${err.raw.slice(0, 500)}` : '');
  res.status(err.status || 500).json({ error: err.message });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`backend on http://localhost:${port} (model ${MODEL})`));
