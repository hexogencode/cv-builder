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
