import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, buildTurnPrompt } from './prompt.js';
import { turnResponseSchema } from './geminiSchema.js';
import { mergeCv, missingFields } from './merge.js';

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.7-flash';
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL?.trim();

let client;
function getClient() {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing in backend/.env');
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

export async function runTurn({ cv = {}, recentMessages = [], userMessage = '' }) {
  const before = missingFields(cv);

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: buildTurnPrompt({ cv, recentMessages, userMessage, missingFields: before }),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: turnResponseSchema,
      temperature: 0.4,
      maxOutputTokens: 4096,
      ...(THINKING_LEVEL && { thinkingConfig: { thinkingLevel: THINKING_LEVEL.toUpperCase() } }),
    },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    const err = new Error('Gemini returned invalid JSON');
    err.status = 502;
    err.raw = response.text;
    throw err;
  }

  const merged = mergeCv(cv, parsed.cv_updates);
  const missing = missingFields(merged);
  const u = response.usageMetadata ?? {};

  return {
    cv: merged,
    reply: parsed.reply ?? '',
    missing_fields: missing,
    // Code has the final say: never "ready" while required fields are missing.
    ready: Boolean(parsed.ready) && missing.length === 0,
    usage: {
      input_tokens: u.promptTokenCount,
      output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    },
  };
}
