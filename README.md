# CV Builder (Gemini)

Gemini interviews you and builds your CV live. Chat on the left, CV preview on the right, print to PDF when done.

## Setup
Needs Node ≥ 20.
```bash
npm install                      # installs root + frontend + backend (npm workspaces)
cp backend/.env.example backend/.env    # then paste your Gemini key into backend/.env
npm run dev                      # frontend :5173 + backend :8787
```
Open http://localhost:5173.

### Frontend without backend / without tokens
```bash
cp frontend/.env.example frontend/.env   # contains VITE_MOCK=true
npm run dev -w frontend
```
The UI then cycles through `shared/fixtures/*.json` instead of calling the API.

### Test the backend without UI
```bash
npm run try -w backend -- "I'm Alex, I study AI at JKU Linz since 2024"
```

## Repo layout
```
shared/     CV schema, API contract, example responses  ← agreed by both
backend/    Express + Gemini (prompt, response schema, merge)
frontend/   Vite + React (chat, live preview, print CSS)
CLAUDE.md   context for Claude sessions; read it
docs/decisions.md   why we built it this way (planning notes)
```

## Workflow
- Branches `fe/...` / `be/...`, small PRs, review each other's.
- Contract changes (`shared/`) → same PR updates fixtures + `backend/src/geminiSchema.js`, and tell your partner.
- Gemini keys only in `backend/.env`. Never commit them. Set a budget alert in Google Cloud billing.
