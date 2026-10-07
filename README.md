# AdaptIQ

AdaptIQ is an adaptive learning and Socratic assessment project. The frontend is a React and TypeScript prototype; the backend is being developed with Python and FastAPI.

## Project structure

- `frontend/` — React, TypeScript, and Vite application.
- `backend/` — FastAPI application, tests, and local PostgreSQL setup.

## Run the frontend

```powershell
cd frontend
bun install
Copy-Item .env.example .env.local
bun run dev
```

## Run the backend

Use Python 3.10 or newer. From the repository root, prepare the local environment:

```powershell
cd backend
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
Copy-Item .env.example .env
```

Edit `backend/.env` and replace the local PostgreSQL password with a value of your choice. Before deploying, set `AUTH_SECRET` to a long random secret and `COOKIE_SECURE=true` when serving over HTTPS. Start the database from `backend/` in a separate terminal:

```powershell
docker compose up -d db
```

Start the API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --reload-dir .\app
```

The API runs at `http://localhost:8000`. Interactive API documentation is available at `http://localhost:8000/docs`. Check `http://localhost:8000/api/health` and `http://localhost:8000/api/health/database`.

## Live question endpoint

On startup, the backend creates the questions table and inserts the four existing sample questions if they are not already present. The frontend can request a question with:

```http
POST /api/generate-question
Content-Type: application/json
```

```json
{
  "topic": "Python Data Structures",
  "elo": 1420,
  "exclude_ids": []
}
```

This endpoint selects a curated question from PostgreSQL; it does not generate new questions with an AI model yet. Correct answers and tutor hints stay on the server and are not included in the question response.

## Accounts, answer evaluation, and progress

When `VITE_USE_LIVE_QUESTIONS=true`, the frontend requires an account before starting a session. Create an account with an email and password of at least 8 characters, or log in with an existing account. Authentication uses a JWT in an HttpOnly cookie, plus a CSRF token for state-changing requests. Passwords are stored as Argon2 hashes.

Authenticated API routes:

- `GET /api/auth/csrf` — initialize the CSRF token.
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` — manage the session.
- `GET /api/auth/me` — return the current learner.
- `POST /api/evaluate` — validate an answer against the server-side answer key and persist the attempt.
- `GET /api/mastery` — return Elo, per-skill accuracy, missed-question concepts, streak, and answer count from the learner's persisted attempts.

The current Elo baseline is 1420. Mastery and attempts are scoped to the authenticated user. The small initial question bank remains curated. AI tutor hints are implemented as described below. Email verification, password reset, rate limiting, and database migration tooling are not implemented yet. Do not use the local development `AUTH_SECRET` default in production.

## AI tutor

Tier 1 and 2 hints stream from OpenAI through the authenticated `GET /api/hint` endpoint. Tier 3 streams the question's curated step-by-step breakdown and is available only after that learner has submitted an answer. The OpenAI key stays on the backend:

1. Add `OPENAI_API_KEY` to `backend/.env`; never put it in a frontend environment file or commit it.
2. Optionally set `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
3. Install backend dependencies again after pulling this change: `.\.venv\Scripts\python.exe -m pip install -e ".[dev]"`.
4. Set `VITE_USE_LIVE_QUESTIONS=true` in `frontend/.env.local` to use the live tutor as well as live questions, evaluations, and progress.

The tutor endpoint requires a signed-in learner. If no server key is configured, it responds with HTTP 503; provider streaming failures are logged by the API and surfaced to the frontend.

Run backend tests with:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Stop the local database with `docker compose down` from `backend/`. The frontend's `.env.local` enables live question selection from the FastAPI question bank, answer evaluation, mastery, and tutor.

## Deploy a free Render demo

The root `render.yaml` defines a Render Blueprint for the frontend, FastAPI API, and PostgreSQL database. The frontend is a TanStack Start server-rendered app, so it runs as a Node web service rather than a static site. The services use Render's free plan and Oregon region; both web services can spin down when idle.

1. Push the project to the Git repository you intend to deploy. Confirm `git remote -v` points to that repository before pushing.
2. In Render, choose **New > Blueprint**, connect the repository, and deploy the root `render.yaml`.
3. After deployment, add `OPENAI_API_KEY` to the `adaptiq-api` service's environment variables if you want live AI tutor hints. Keep this key only in Render's backend environment.
4. Open the `adaptiq-web` URL. Register a new account and test sign-in, question evaluation, progress, and tutor behavior.

Render configures the database URL, generated authentication secret, HTTPS-only cookies, live API mode, and frontend/API host references through the Blueprint. The API dynamically trusts the deployed frontend host for CORS and CSRF origin validation.

**Free database warning:** Render's free PostgreSQL database expires 30 days after creation. After expiry, it becomes inaccessible; after a further 14-day grace period without upgrading, Render deletes its data. Free web services also sleep when idle, so the first request can be slow. This free setup is for a short-lived portfolio demo, not production or durable learner data. Upgrade the database before expiry if you need to preserve accounts and attempts. Deployment starts with a fresh database; local accounts and attempts are not migrated.
