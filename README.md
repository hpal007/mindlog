# MindLog — a GenAI Mental Wellness Companion for Exam Aspirants

> **Demo:** _<!-- DEMO_URL: filled in after deploy -->_ `https://<your-app>.vercel.app`

MindLog lets a student journal freely and log their mood. Google Gemini reads their **own
words** to surface hidden stress triggers and emotional patterns a number-on-a-scale tracker
misses, then responds with a personalized coping exercise from a self-growing library, a
grounded chat companion, and trends over time — behind a hard safety layer that routes acute
crisis signals to real India helplines and never tries to "treat" them.

Built for the **Hack2Skill × Google for Developers "PromptWars" / Build-with-AI** challenge:
_Mental Wellness Tracker_.

> ⚠️ MindLog is a supportive companion, **not** a medical or clinical service, not for
> emergencies, and not a substitute for professional care. The disclaimer is shown on every
> screen.

---

## 1. Chosen vertical / persona

**Indian competitive-exam aspirants** preparing for **NEET / JEE / CUET / CAT / GATE / UPSC**,
roughly **ages 16–26**, under sustained, high-stakes academic pressure for months at a time.

This cohort faces severe stress, burnout, and self-doubt, but generic mood trackers only
capture a 1–5 number — they never read the student's words, so they miss *why* stress spikes
(a specific subject, a mock-test rank drop, family expectation, sleep collapse). MindLog is
built around that gap.

## 2. Approach & logic

- **Read the words, not just the number.** Each journal entry goes through **one** structured
  Gemini streaming call that returns triggers (each with an **evidence span quoted from the
  student's own text**), emotions, themes, a `risk_level`, and a warm summary — all in a single
  request (efficiency: one model call per entry on the happy path, a second only when a brand-new
  exercise must be generated).
- **Zod is the single source of truth.** Every shared shape lives once in `lib/schemas/`. App
  TS types are `z.infer`red from those schemas, and the **same** schema validates API input,
  the Gemini structured output, and DB writes — no hand-maintained duplicate shapes.
- **Dual-signal safety (defense in depth).** Risk is decided by **two independent signals**:
  the model's structured `risk_level` **and** a deterministic, no-LLM keyword/regex backstop
  (`lib/safety/classifier.ts`). **Either** can trip the crisis path, so a model miss still
  surfaces helplines. The backstop is exam-idiom-aware: figurative venting like _"this exam is
  killing me"_, _"I'm dead if I fail"_, _"dying to get into IIT"_, or _"this syllabus is
  murder"_ is explicitly excluded from acute detection to avoid false alarms.
- **Self-growing exercise library.** On each analyzed entry the app **matches** an existing
  exercise (tag overlap + text similarity, weighted by proven effectiveness) or, if nothing
  clears the bar, **generates** a fresh one, **validates** it with Zod, and **dedups** it
  before persisting — so the library grows without polluting itself.
- **Trust-but-verify the model.** Model output is Zod-parsed; risk aggregation, trend
  computation, and effectiveness math are done deterministically server-side, not trusted to
  the LLM.
- **Secrets stay server-side.** The Gemini key and Supabase service-role key are never exposed
  to the client (never `NEXT_PUBLIC`), every boundary is validated, errors to the client are
  generic, and the paid LLM endpoints are rate-limited via a persistent Postgres counter.

## 3. How it works (the flow)

```
Browser (React Server + Client Components)
  │  journal + mood form · streaming analysis · exercise player · chat · trends
  ▼
Next.js Route Handlers  (/app/api/*)
  ├─ POST /api/entries   validate → rate-limit → keyword backstop + ONE structured
  │                      streaming Gemini analysis → dual-signal crisis gate
  │                      → (acute) crisis resources  |  (else) recommend exercise
  ├─ GET  /api/entries   RLS-scoped history
  ├─ POST /api/chat      streaming companion, grounded in recent triggers
  │                      (same keyword backstop runs first — hard-stops on acute)
  ├─ POST /api/feedback  exercise effectiveness → updates avg_effectiveness
  └─ GET  /api/trends    mood series + top triggers + plain-language insights
  │
  ├─ lib/ai/gemini.ts          Gemini client (stream + structured, maxOutputTokens capped)
  ├─ lib/safety/classifier.ts  deterministic keyword/regex backstop (cheap, no LLM)
  ├─ lib/library/recommend.ts  match existing exercise OR generate + validate + dedup
  ├─ lib/ratelimit.ts          persistent Postgres-counter limiter
  └─ lib/schemas/index.ts      Zod schemas — THE single source of truth
  ▼
Supabase Postgres (RLS on every user-scoped table) + Google Gemini API
```

1. **Journal → streamed analysis.** The student writes freely and picks a mood. `POST
   /api/entries` streams the analysis back as NDJSON — reflection tokens arrive live (no
   multi-second blank wait), then a final structured result with triggers, emotions, themes,
   and risk.
2. **Recommend a coping exercise.** Non-acute entries get a match-or-generate exercise from the
   self-growing library, delivered as a step-by-step guided player (timed breathing steps get
   a calm countdown).
3. **Chat companion.** `POST /api/chat` streams an empathetic Gemini reply token-by-token,
   grounded in the student's recent triggers. The keyword backstop scans every chat message
   first — on an acute hit it **hard-stops** and escalates to the crisis banner instead of
   replying.
4. **Trends.** `GET /api/trends` aggregates mood over time and top recurring triggers, plus
   1–3 plain-language insight statements ("Your mood tends to dip on days you mention *mock
   test*") — all heuristic, no extra LLM call.
5. **Crisis safety.** On an acute signal from **either** the model or the keyword backstop, the
   coping flow is skipped, India helplines (KIRAN, Tele-MANAS, AASRA, iCall) are shown as
   tappable `tel:` links with a grounding message, and a `crisis_events` audit row is written.
6. **Always-on disclaimer.** Every screen carries the "not a clinical service" disclaimer.

## 4. Assumptions made

- **Seeded demo session, no real auth.** Under the 1-hour build clock we skip signup /
  email-confirm and run a single fixed demo `user_id` (`DEMO_USER_ID`). The app talks to
  Postgres with the service-role key and scopes every query by an explicit `user_id`.
- **RLS stays ON regardless.** Row-Level Security policies (`auth.uid() = user_id`) are enabled
  on every user-scoped table so the per-user isolation story is **real and testable** — the RLS
  cross-user denial test proves a client scoped to user A reads **zero** of user B's rows.
- **Gemini is the engine.** Analysis, chat, and exercise generation all run through Google
  Gemini via the current unified **`@google/genai`** SDK (not the legacy SDK). The deterministic
  safety pass is intentionally **not** an LLM call (cheaper, faster, never "misses" on cost).
- **The safety backstop is conservative but idiom-aware.** It errs toward catching genuine
  self-harm/suicidal ideation while excluding common Indian exam-venting idioms. It is a
  backstop, not a diagnosis.
- **Curated cold-start.** The library is seeded with ~8 curated exercises so the first
  recommendation is never AI-only.
- **English-only** content (India helplines included regardless); web-responsive only (no
  native apps); voice journaling and real payments are out of scope.

---

## Environment variables

Copy `.env.example` → `.env.local` and fill in real values (`.env.local` is gitignored; only
`.env.example` is committed — **no secrets in the repo**).

| Variable | Scope | Purpose |
|----------|-------|---------|
| `GEMINI_API_KEY` | server only | Google Gemini API key (the mandatory engine). **Never** `NEXT_PUBLIC`. Get one at <https://aistudio.google.com/apikey>. |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-enforced client). |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Supabase service-role key (bypasses RLS; sole writer). **Secret.** |
| `DEMO_USER_ID` | server | Seeded demo session user id (defaults to `00000000-0000-0000-0000-000000000001`). |

For the **RLS test in CI** (optional), the workflow also reads `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` from repo secrets (see below).

## AI usage notes

- **SDK:** `@google/genai` (the current unified Google GenAI SDK — not legacy
  `@google/generative-ai`).
- **One structured streaming call** per entry: a forced `responseSchema` returns triggers,
  emotions, themes, `risk_level`, and a summary in a single request, streamed token-by-token
  for responsive UX. `maxOutputTokens` is capped for efficiency; one targeted retry on parse
  failure (not a full re-generation).
- **Zod validates model output**, not just input — the app never blindly trusts the model.
- **No LLM in the safety backstop** and **no LLM in trends** — deterministic, cheap, testable.

## Local setup

```bash
# 1) Install
npm ci

# 2) Configure env
cp .env.example .env.local         # then fill in real values

# 3) Apply the database schema to your Supabase project
#    (SQL Editor → run, in order, the files in supabase/migrations/)
#      0001_init.sql · 0002_rls.sql · 0003_seed.sql · 0004_ratelimit.sql
#    See SUPABASE_NOTES.md for details.

# 4) Run the app
npm run dev                        # http://localhost:3000
```

## Test commands

```bash
npm run test         # vitest run — unit + route/orchestration + component (LLM mocked, no network)
npm run test:watch   # watch mode
npm run coverage     # vitest run --coverage (v8, text + json-summary)
npm run typecheck    # tsc --noEmit
```

**Test layers** (`tests/`):

| Layer | Files | What it covers |
|-------|-------|----------------|
| Unit | `tests/unit/` | Zod schema validation (boundaries); the exam-idiom-aware safety classifier (incl. false-positive idioms); the library match scorer + dedup. |
| Route / orchestration | `tests/routes/` | `POST /api/entries` (success stream, 400, 429, Gemini failure, acute-via-model, acute-via-keyword, match-vs-generate), streaming `POST /api/chat` (+ acute hard-stop), `POST /api/feedback`, `GET /api/trends`. **LLM + DB mocked** — no network. |
| Component | `tests/components/` | `CrisisResourceBanner` (alert + `tel:` links), `JournalEditor` (labelled inputs + submit gating), `ExercisePlayer` (steps + advance). |
| RLS | `tests/routes/rls.test.ts` | Cross-user denial against **real Postgres** — env-gated (runs in CI when Supabase secrets are set; self-skips locally). |

The LLM is **always mocked** in tests, so `npm run test` needs no Gemini key and never hits the
network.

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`:

1. **`test` job** (always green): `npm ci` → `tsc --noEmit` → `npm run test` → `npm run
   coverage`. No live keys; the LLM is mocked.
2. **`rls` job** (push to `main`): runs `tests/routes/rls.test.ts` against a real Supabase
   project **if** the `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` repo
   secrets are configured; otherwise the test self-skips. The migrations target Supabase's
   `auth.users` / `auth.uid()` surface, so the RLS proof runs against a real (free-tier)
   Supabase project rather than a bare Postgres container that can't satisfy the auth surface.
