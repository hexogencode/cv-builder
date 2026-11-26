// Talks to the backend, or to fixtures when VITE_MOCK=true (see shared/api.md).
import start from '../../shared/fixtures/turn-1-start.json';
import partial from '../../shared/fixtures/turn-2-partial.json';
import ready from '../../shared/fixtures/turn-3-ready.json';

export const MOCK = import.meta.env.VITE_MOCK === 'true';
const MAX_MESSAGES = 6;
const mockSteps = [start, partial, ready];
let mockIndex = 0;

export async function sendTurn({ cv, messages, userMessage }) {
  const recent_messages = messages.slice(-MAX_MESSAGES).map(({ role, text }) => ({ role, text }));

  if (MOCK) {
    // Pick the step before the fake delay, so "Start over" mid-request can't shift the order.
    const step = mockSteps[Math.min(mockIndex++, mockSteps.length - 1)];
    await new Promise((r) => setTimeout(r, 500));
    return structuredClone(step);
  }

  const res = await fetch('/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cv, recent_messages, user_message: userMessage }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function resetMock() {
  mockIndex = 0;
}

// ---------- Import an existing CV (PDF) ----------
// 1) POST /api/import (contract in shared/api.md; backend stub returns 501 until it's built).
// 2) Fallback while it's 501: read the PDF's text in the browser and let Gemini fill the CV via /api/turn.
const MAX_IMPORT_CHARS = 3600; // backend caps user_message at 4000 chars

export const IMPORT_PROMPT =
  'Here is the text of my existing CV, extracted from a PDF. Fill the CV JSON from it: keep my facts, ' +
  'fix formatting, write clean bullets, do not invent anything. Then tell me in 1-2 sentences what is missing ' +
  'or weak and ask me about the most important gap.\n\n';

async function pdfToText(file) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    let line = '';
    const lines = [];
    for (const item of content.items) {
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; } else if (item.str && !item.str.endsWith(' ')) line += ' ';
    }
    if (line) lines.push(line);
    pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n'));
  }
  return pages.join('\n\n').trim();
}

export async function importCv(file) {
  if (MOCK) {
    await new Promise((r) => setTimeout(r, 1200));
    mockIndex = mockSteps.length - 1; // continue the mock as if the CV were complete
    return { ...structuredClone(ready), reply: 'I imported your CV. Looks solid! One gap: none of your bullets has a result or number — what did your best project achieve?' };
  }

  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/import', { method: 'POST', body: form }).catch(() => null);
  if (res?.ok) return res.json();
  if (res && res.status !== 501 && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Import failed (${res.status})`);
  }

  const text = await pdfToText(file);
  if (text.length < 80) {
    throw new Error('Could not read text from this PDF (is it a scanned image?). Try "Create from scratch" instead.');
  }
  return sendTurn({ cv: {}, messages: [], userMessage: IMPORT_PROMPT + text.slice(0, MAX_IMPORT_CHARS) });
}
