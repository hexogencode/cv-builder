# API contract

Base URL in dev: `http://localhost:8787` (the Vite dev server proxies `/api` there).
All bodies are JSON. The CV object always follows `shared/cv.schema.json`.
Changing anything here = update this file + `shared/fixtures/` in the same PR and tell your partner.

---

## `POST /api/turn` (core loop)

One interview step. The frontend sends the whole current CV plus the last few messages; the backend asks Gemini what changed and what to ask next.

**Request**
```json
{
  "cv": { "...": "current CV object (may be {})" },
  "recent_messages": [
    { "role": "assistant", "text": "What role are you aiming for?" },
    { "role": "user", "text": "ML internship, summer 2027" }
  ],
  "user_message": "I study AI at JKU Linz since Oct 2024"
}
```
- `recent_messages`: last **max 6** messages, oldest first. Don't send the full history (token cost).
- `user_message`: may be `""` on the very first turn. The backend then returns the opening question.

**Response 200**
```json
{
  "cv": { "...": "full CV after merging Gemini's updates" },
  "reply": "Nice. Which degree exactly, and when do you expect to finish?",
  "missing_fields": ["personal.email", "skills"],
  "ready": false,
  "usage": { "input_tokens": 2100, "output_tokens": 380 }
}
```
- `cv`: the frontend **replaces** its CV with this (no client-side merging).
- `reply`: the assistant message to show (usually ends with the next question).
- `missing_fields`: required fields still empty (computed by code, not Gemini). See the list below.
- `ready`: true when required fields are filled **and** Gemini thinks the CV is solid. The frontend shows "CV ready" and the user can still keep chatting to improve it.
- `usage`: for keeping an eye on the $5 budget. May be missing.

**Errors**: `400 {error}` bad input · `502 {error}` Gemini failed or returned invalid JSON · `500 {error}`.

### Required fields (definition of "enough info")
- `personal.full_name`
- `personal.email`
- `education` or `experience`: at least one entry in either
- `skills`: at least one category with ≥1 item

---

## `POST /api/import` (planned, stub returns 501)
Upload an existing CV/LinkedIn PDF → prefilled CV.
Request: `multipart/form-data` with field `file` (PDF, ≤ 5 MB).
Response: same shape as `/api/turn`.

## `POST /api/tailor` (planned, stub returns 501)
Request: `{ "cv": {...}, "job_posting": "pasted text" }`
Response: `{ "cv": {...}, "reply": "what changed + missing skills", "missing_fields": [], "ready": true }`

## `GET /api/health`
`{ "ok": true, "model": "gemini-...", "has_key": true }`
