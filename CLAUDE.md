# CV Builder: shared context for Claude sessions

Read this before touching code. Both devs use Claude; this file keeps the two sessions consistent.

## What we're building
A web app where **Gemini interviews the user** and fills a structured CV in real time.
Left: chat. Right: live CV preview that updates every turn. When enough info is collected, the user prints/saves the CV as PDF.
Event requirement: Gemini must be the core functionality. Gemini is the interviewer (decides what to ask, extracts structured data from messy answers, asks follow-ups on vague answers, writes bullets/summary from facts the user gave). Rendering is plain code.

## Architecture
```
frontend (Vite + React, :5173) --/api--> backend (Express, :8787) --> Gemini API (@google/genai)
```
- **Single source of truth:** the CV JSON (`shared/cv.schema.json`).
- Each turn: frontend sends `{cv, recent_messages (≤6), user_message}` → backend asks Gemini for `{cv_updates, reply, ready}` (structured JSON output) → backend merges updates, computes `missing_fields` by code → returns full CV.
- Merge rule (backend/src/merge.js): top-level sections; objects (`meta`, `personal`) are shallow-merged, arrays (`education`, `experience`, …) are **replaced whole** by Gemini's version.
- CV is rendered by React from JSON + print CSS. **Never** have Gemini produce HTML/PDF.
- State lives in the browser (localStorage). No DB, no accounts.

## Ownership (don't edit the other person's folder)
- `/frontend`: frontend dev
- `/backend`: backend dev (incl. prompt + Gemini schema)
- `/shared`: **both, by agreement only.** Claude must not change `/shared` unless the user explicitly says the change was agreed. If a change to the contract seems needed, propose it instead of making it.
- If you change the contract: update `shared/api.md`, `shared/cv.schema.json`, `shared/fixtures/`, and `backend/src/geminiSchema.js` in the same PR.

## Budget rules ($5 per Gemini key; keep it)
- Use a Flash / Flash-Lite model (`GEMINI_MODEL` in `.env`), low thinking level.
- Send only the CV JSON + last ≤6 messages, never the full chat history.
- Frontend dev works in **mock mode** (`VITE_MOCK=true`): no backend, no tokens.
- Develop on a free-tier AI Studio key; the paid key is for the demo.
- API keys only in `backend/.env` (gitignored). Never in frontend code, never committed.

## Conventions
- JavaScript (ES modules), no TypeScript. Node ≥ 20.
- Small PRs, one branch per feature: `fe/<thing>`, `be/<thing>`.
- `npm run dev` at repo root starts both apps.

## Roadmap
1. MVP: `/api/turn` loop + chat + live preview + print to PDF
2. `/api/import`: upload old CV/LinkedIn PDF → prefill (Gemini multimodal)
3. `/api/tailor`: paste job posting → reorder/reword CV, list missing skills
4. EN/DE toggle incl. Austrian Lebenslauf conventions
5. 2–3 CSS themes
