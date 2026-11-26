import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, buildTurnPrompt } from './prompt.js';
import { turnResponseSchema } from './geminiSchema.js';
import { mergeCv, missingFields } from './merge.js';

export const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.7-flash';
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL?.trim();
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL?.trim();

const RETRY_DELAYS_MS = [800, 1800];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let client;
function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing in backend/.env');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function isTransientError(err) {
  const code = Number(err?.status ?? err?.code);
  if ([429, 500, 502, 503, 504].includes(code)) return true;
  const msg = String(err?.message ?? '');
  return /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|fetch failed/i.test(msg);
}

async function generateWithRetry({ contents, config }) {
  const ai = getClient();
  let lastErr;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await ai.models.generateContent({ model: MODEL, contents, config });
    } catch (err) {
      lastErr = err;
      if (!isTransientError(err) || attempt === RETRY_DELAYS_MS.length) break;
      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(`[gemini] ${MODEL} transient error (${err.status ?? 'net'}), retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  if (FALLBACK_MODEL && FALLBACK_MODEL !== MODEL && isTransientError(lastErr)) {
    console.warn(`[gemini] falling back from ${MODEL} to ${FALLBACK_MODEL}`);
    return await ai.models.generateContent({ model: FALLBACK_MODEL, contents, config });
  }

  throw lastErr;
}

export async function runTurn({ cv = {}, recentMessages = [], userMessage = '' }) {
  const before = missingFields(cv);
  const contents = buildTurnPrompt({ cv, recentMessages, userMessage, missingFields: before });
  const config = {
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: 'application/json',
    responseSchema: turnResponseSchema,
    temperature: 0.4,
    // Higher ceiling prevents JSON truncation during full-CV translation or with thinking enabled.
    maxOutputTokens: 8192,
    ...(THINKING_LEVEL && { thinkingConfig: { thinkingLevel: THINKING_LEVEL.toUpperCase() } }),
  };

  const response = await generateWithRetry({ contents, config });
  const finishReason = response.candidates?.[0]?.finishReason;
  const rawText = response.text ?? '';

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const err = new Error(
      finishReason === 'MAX_TOKENS'
        ? 'Gemini output was cut off (MAX_TOKENS); try again or shorten the CV.'
        : 'Gemini returned invalid JSON',
    );
    err.status = 502;
    err.raw = rawText;
    throw err;
  }

  const merged = mergeCv(cv, parsed.cv_updates);
  const missing = missingFields(merged);
  const u = response.usageMetadata ?? {};

  return {
    cv: merged,
    reply: typeof parsed.reply === 'string' ? parsed.reply : '',
    missing_fields: missing,
    // Code has the final say: never "ready" while required fields are missing.
    ready: Boolean(parsed.ready) && missing.length === 0,
    usage: {
      input_tokens: u.promptTokenCount ?? 0,
      output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    },
  };
}