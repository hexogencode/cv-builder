# Backend handoff: what the frontend now expects (2026-11-26)

For the backend dev and their Claude session. Read `CLAUDE.md` (working rules) and `docs/decisions.md` (the why) first.
This file lists what changed on the frontend and what the backend still needs to do.

**Short version:** the API contract did **not** change. Everything new on the frontend goes through the existing
`POST /api/turn`. The backend work is: get the first real Gemini call running, then teach the prompt to handle
"refinement" requests (review, apply hints, stronger bullets, shorter, translate) once the CV is ready.

---

## 1. What changed on the frontend (branch `fe/ui`)

| Feature | What it sends to the backend |
|---|---|
| Dark/light theme, animations, progress bar, confetti | Nothing new |
| **Photo upload** | **Nothing.** The photo stays in the browser's localStorage and is never sent. Don't add a photo field to the schema or to Gemini calls (token cost + privacy). |
| **Manual edit mode** (user fixes CV text by hand) | The edited CV arrives as the normal `cv` field on the next `/api/turn`. Gemini must treat it as the truth and not undo it. |
| **Gemini hint buttons** (shown only when `ready: true`) | A normal `/api/turn` whose `user_message` is one of the fixed instructions below. |
| Chat shows a short label for hint buttons | The label is frontend-only. `recent_messages` still contains the full instruction text (`role` + `text` only). |
| "Start over" fix | Nothing new |

### Exact `user_message` texts the hint buttons send
(Source: `frontend/src/components/Fx.jsx`, `hintActions()`.)

1. **Review:** `Review my CV like a strict recruiter. Give me the 3 most important improvements as a short numbered list. Do not change the CV yet.`
2. **Apply** (only shown after a review): `Apply the improvements you just suggested to the CV. Only use facts I already gave you; if something needs info you do not have, ask me for it.`
3. **Stronger bullets:** `Rewrite my bullet points to be stronger and more specific: strong verb, tool/tech, result. Only use facts I already gave you.`
4. **Shorter:** `Make the CV more concise so it fits on one page. Keep all required info.`
5. **Translate:** `Switch the CV to German: set meta.cv_language to "de" and translate all CV content into German.`
   (or the English version: `Switch the CV to English: set meta.cv_language to "en" and translate all CV content.`)

Users can also type free-form corrections at any time ("change my headline to …", "remove the second project").

---

## 2. Backend TODO (in priority order)

### 2.1 First real end-to-end run (blocker)
- [ ] Copy `backend/.env.example` → `backend/.env`, add a key (free AI Studio key for dev; the $5 key is for the demo).
- [ ] Check that `GEMINI_MODEL` is a real model id in AI Studio's model list (default `gemini-3.7-flash` is unverified).
- [ ] Check that `GEMINI_THINKING_LEVEL=low` is accepted; if the API rejects it, leave it empty.
- [ ] `npm run try -w backend -- "I'm Alex, I study AI at JKU Linz since 2024"` → returns JSON with a `reply` and a `cv` containing JKU.
- [ ] `npm run dev` at the root, set `VITE_MOCK=false` in `frontend/.env`, run one full interview in the browser until `ready: true`.

### 2.2 Prompt: refinement mode (`backend/src/prompt.js`, `SYSTEM_PROMPT`)
The current prompt is interview-focused and caps replies at 60 words. Add a section like this (wording is a suggestion; iterate):

```
REFINEMENT (after the CV is complete)
- The CV JSON you receive may contain edits the user made by hand. Treat it as the source of truth:
  never revert or "fix back" those values.
- If the user asks for a review: reply with up to 3 numbered, concrete hints (max 100 words total).
  Do NOT change the CV in that turn (empty cv_updates).
- If the user asks to apply your hints: apply only the hints from your previous message. If a hint needs
  facts you don't have (e.g. a number or result), ask for them instead of inventing them.
- Stronger bullets / shorter / translate: return the complete changed arrays as usual. Still never invent facts.
- Translate: set meta.cv_language and translate every text field of the CV (summary, headline, bullets,
  degree/field, titles, skill categories). Keep names, company names, URLs and emails unchanged.
- Once the CV is complete, keep ready = true on refinement turns unless a required field became empty.
  Keep the reply short and say what you changed.
```

Why the last point matters: the frontend only shows the hint buttons while `ready` is true. If Gemini flips
`ready` to false after a review, the buttons disappear mid-demo.

### 2.3 Check these edge cases
- [ ] **Review turn doesn't change the CV:** after "Review…", the returned `cv` equals the sent `cv`.
- [ ] **Manual edits survive:** send a CV whose `personal.full_name` was changed by hand, then "Stronger bullets" → the name stays changed.
- [ ] **No invented facts:** "Apply your hints" when a hint asks for a number the user never gave → Gemini asks for it rather than making one up.
- [ ] **Translate:** all CV text is German afterwards, `meta.cv_language === "de"`, email/URLs/names unchanged.
- [ ] **Output size:** translate returns every array section. If the JSON gets cut off (502 "invalid JSON"), raise `maxOutputTokens` in `backend/src/gemini.js` (currently 4096).
- [ ] **Deleting things:** `mergeCv` drops empty strings from `meta`/`personal`, so Gemini can't clear a personal field by sending `""`. That's intended for now; tell the frontend dev if a refinement needs to delete a personal field.

**Quick test without the UI** (backend running on :8787; uses the "ready" fixture as the current CV):
```bash
node -e "const f=require('./shared/fixtures/turn-3-ready.json');fetch('http://localhost:8787/api/turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cv:f.cv,recent_messages:[],user_message:process.argv[1]})}).then(r=>r.json()).then(j=>console.log(j.reply,'\nready:',j.ready,'\nchanged:',JSON.stringify(j.cv)!==JSON.stringify(f.cv)))" "Review my CV like a strict recruiter. Give me the 3 most important improvements as a short numbered list. Do not change the CV yet."
```
Expected: 3 numbered hints, `ready: true`, `changed: false`.

### 2.4 Budget
Refinement turns are bigger than interview turns (translate/"shorter" return whole sections).
Watch the `[turn] in=… out=…` log line. A translate turn should stay well under ~3k output tokens.
Keep Flash/Flash-Lite and a low thinking level.

### 2.5 Next feature, if there's time: `/api/import` (already stubbed, returns 501)
Upload an old CV PDF → Gemini prefills the CV JSON → the interview only asks for the gaps. Contract is in
`shared/api.md` (multipart field `file`, PDF ≤ 5 MB, response shape = `/api/turn`). Coordinate with the frontend
dev before starting, since it needs an upload button on their side.

---

## 3. Rules (from CLAUDE.md, repeated because they matter)
- Only edit `/backend`. `/shared` changes need agreement from the whole team, and the same PR must update
  `shared/api.md`, `shared/cv.schema.json`, `shared/fixtures/` and `backend/src/geminiSchema.js`.
- None of the above needs a `/shared` change. If you think one is needed, propose it, don't just make it.
- API keys only in `backend/.env`. Never commit it.
- Small PRs on `be/<thing>` branches.

## 4. Known frontend gaps (not backend work, FYI)
- CV section headings ("Experience", "Skills", …) are hard-coded in English; when `cv_language` is `de`
  they should become German. Frontend will fix this.
- In mock mode every hint button returns the same fake answer; real behaviour only shows with the backend running.
