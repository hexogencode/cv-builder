# Project decisions & background (from planning chat, 2026-11-26)

Handoff notes for teammates and their Claude sessions. `CLAUDE.md` has the working rules; this file has the *why*.

## The event
- Linz DevFest-style build: use any stack, but **Gemini must be the core functionality**.
- Budget: **$5 Gemini credit per person** (we have two keys).
- Organisers offered starter templates (AI barista/portfolio bot in AI Studio, Maps + Gemini local guide, AI mini-game). We chose our own idea instead.

## The idea: conversational CV builder
- A user answers questions → the app collects CV info → when there's enough, it shows a finished CV they can save as PDF.
- **Risk:** CV builders are a common idea. If Gemini only rewrites form fields, it's just "a form with an AI button".
- **Decision: Gemini is the interviewer.** It decides what to ask next, extracts structured data from messy answers, asks follow-ups on vague answers ("what did *you* build, which tech, what result?"), writes bullets/summary only from facts the user gave, and decides when the CV is solid. That's what makes it "Gemini at the core".

## Architecture decisions
| Decision | Why |
|---|---|
| CV JSON is the single source of truth (`shared/cv.schema.json`) | Clear contract between frontend and backend; enables parallel work |
| Gemini returns structured JSON (response schema), not free text | Reliable parsing, no broken CVs |
| Gemini returns only *changed sections* (`cv_updates`); backend merges | Fewer output tokens = cheaper |
| CV rendered by React + print CSS, never by Gemini | Free, instant, consistent; PDF via browser print |
| "Missing required fields" computed by code; Gemini can't mark ready while fields are missing | Deterministic, no hallucinated "done" |
| Send CV JSON + last ≤6 messages, not full history | Keeps each turn cheap |
| Backend proxy holds the API key | A key in browser code can be stolen once deployed |
| State in localStorage, no DB/accounts | Scope; not needed for a demo |
| Stack: Vite + React, Express, `@google/genai` (all JS) | One language across the repo |

## Budget estimate
- Flash pricing at time of planning: ~$0.75 / 1M input, ~$3.75 / 1M output (intro pricing through Dec 31 2026; doubles from Jan 2027). Flash-Lite is cheaper.
- ~3k tokens in + ~500 out per turn ≈ $0.004 → full CV (~20 turns) ≈ $0.08 → **~60 full CVs per $5**.
- Budget killers: Pro models, high thinking level (thinking tokens bill as output), image/video generation, full chat history in every call.
- Develop on the free AI Studio tier / mock mode; keep the paid key for the demo. Set a billing budget alert.

## How we work in parallel
1. **Phase 0 (together):** agree schema + API contract + fixtures. ✅ done in the skeleton
2. **Phase 1 (parallel):** frontend builds against mock mode (`VITE_MOCK=true`); backend iterates on prompt/schema with `npm run try -w backend`.
3. **Phase 2:** integrate, full test run. Budget half a day.
4. **Phase 3:** split extras by feature.
- Rules: own folders only; `/shared` changes by agreement + same PR updates fixtures and `backend/src/geminiSchema.js`; small PRs on `fe/*` / `be/*` branches; keys only in `backend/.env`.

## Extensions (ranked by demo value per effort)
1. **PDF import:** upload old CV/LinkedIn PDF → Gemini prefills JSON → interview only asks for gaps (multimodal showcase).
2. **Job tailoring:** paste a job posting → reorder/reword CV, list missing skills.
3. **EN/DE toggle:** incl. Austrian Lebenslauf conventions (photo, date of birth). Relevant for a Linz audience.
4. Extra CSS themes.

## Open items
- Verify the exact Gemini model id in AI Studio (`GEMINI_MODEL`, default `gemini-3.7-flash`) and that `GEMINI_THINKING_LEVEL=low` is accepted.
- First real end-to-end Gemini test hasn't been run yet.
- Decide who takes frontend vs backend/prompt.
- Deployment target (if a public link is needed for the demo).
