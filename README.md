# PrepPilot — The AI Interview Prep Kit

PrepPilot turns a pasted job description, company URL, and interview timeline into a research-driven interview preparation kit. The implementation follows the Trao Full-Stack Engineering Assessment contract, including Appendix A kit structure and the mandatory Appendix B batch evaluator.

## Live Demo

**Hosted application:** https://preppilot-lac-five.vercel.app

## Highlights

- 🔐 Secure authentication with protected user-owned kits
- 🔎 Company research with bounded crawling and public interview research
- 🧠 Multi-stage AI generation with deterministic coverage validation
- 🎯 Technical, behavioral, system-design and company-fit questions
- 🔄 Second-pass generation for uncovered requirements
- ✏️ Editable, reorderable and customizable question bank
- ♻️ Regeneration that preserves user edits, pins and custom questions
- 🃏 Flashcards and confidence-based practice
- 📅 Deterministic preparation schedules for 1–60 days
- 🛡️ SSRF protection, content limits, validation and structured errors


## Architecture

```text
Next.js UI
  ├─ Authentication UI
  ├─ Kit Builder
  ├─ Practice Mode
  └─ Schedule View
        │ HTTP + HttpOnly session cookie
        ▼
Express API
  ├─ Auth + authorization
  ├─ Kit persistence
  └─ Generation orchestration
        │
        ├─ Retrieval / robots / SSRF checks
        ├─ Requirement extraction
        ├─ Company + hiring research
        ├─ Separate question-category generation
        ├─ Deterministic coverage check + second pass
        ├─ Flashcards
        ├─ Deterministic schedule allocation
        └─ Zod structure + cross-reference validation
              │
              ▼
           MongoDB
```
## Project Structure

```text
PrepPilot/
├── frontend/              # Next.js + Tailwind UI
│   ├── app/
│   └── ...
├── backend/               # Express + TypeScript API
│   └── src/
│       ├── crawler/
│       ├── config/
│       ├── middleware/
│       ├── models/
│       ├── scheduler/
│       ├── types/
│       └── ...
├── cases.example.json     # Example evaluator input
└── README.md
```
## Design decisions

### Authentication and authorization

Passwords use Node's `scrypt` password hashing. Sessions use signed HS256 JWTs stored in an HttpOnly cookie. Every kit query is scoped by the authenticated user's id, so a user cannot read or modify another user's kit. There is no unnecessary role hierarchy because the assessment explicitly treats role hierarchies as out of scope.

### Pipeline sequencing

The pipeline is deliberately staged. The job description is extracted without retrieval, the company site is crawled before company synthesis, question generation runs separately for technical, behavioural, system-design and company-fit categories, deterministic code checks requirement coverage, and uncovered requirements trigger a targeted second pass. Scheduling is arithmetic in TypeScript rather than an LLM decision.

### State-preserving regeneration

The builder keeps generated, edited, pinned and custom item state separately from content. Backend regeneration protects edited, pinned and custom questions in the regenerated category. The schedule is rebuilt after question regeneration so schedule references remain valid.

### Retrieval safety and resilience

Company retrieval validates HTTP(S) URLs, blocks loopback/private IP literals, respects robots.txt, restricts content size/type, follows relative links from the actual supplied URL, ranks relevant internal pages, and treats public research as untrusted text. Retrieval failures are recorded as missing research instead of inventing facts. LLM calls use bounded retry/backoff for transient provider failures.

### Validation

Zod validates Appendix A fields and additional deterministic checks verify unique ids, requirement/question/flashcard references, exact schedule day count, and valid schedule question references before a kit is returned or saved.

## Local setup

Requirements: Node.js 18+ and MongoDB.

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Set `GEMINI_API_KEY`, `MONGODB_URI`, and a random `JWT_SECRET` of at least 32 characters.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_API_URL` to the backend origin.

## Production deployment

Deploy the backend and frontend as separate services.

Backend environment:

```text
NODE_ENV=production
PORT=<platform supplied port>
FRONTEND_URL=https://<frontend-domain>
COOKIE_SAMESITE=None
MONGODB_URI=<managed MongoDB connection string>
GEMINI_API_KEY=<provider key>
GEMINI_MODEL=gemini-3.6-flash
JWT_SECRET=<random secret, 32+ characters>
SCRAPER_TIMEOUT_MS=8000
```

Frontend environment:

```text
NEXT_PUBLIC_API_URL=https://<backend-domain>
```

Backend build/start:

```bash
npm run build
npm start
```

Frontend build/start:

```bash
npm run build
npm start
```

The production frontend must use HTTPS so the secure HttpOnly session cookie can be used cross-origin.
## Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Database | MongoDB Atlas |
| AI | Gemini |

**Live application:** https://preppilot-lac-five.vercel.app

**Repository:** https://github.com/Ek1gra/PrepPilot

## Mandatory evaluator

From the repository root:

```bash
npm install
npm run evaluate -- --input cases.json --output kits.json
```

The evaluator runs the same `runPrepKitPipeline` used by the API, records each case independently, and writes the Appendix B envelope. It continues after individual case failures.

## Tests

```bash
npm run backend:test
```

The test suite covers deterministic coverage, schedule allocation, Appendix A cross-reference validation, and retrieval URL safety.

## Known trade-offs

The crawler is intentionally bounded rather than attempting an unrestricted site crawl. Public interview discussion is treated as supporting research and is never allowed to override facts from the posting or company pages. Practice confidence is session-local in the current UI; the generated kit itself remains persistable and reopenable.
