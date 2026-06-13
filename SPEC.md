# Spec: MindLog — GenAI Mental Wellness Companion for Exam Aspirants

> H2S PromptWars submission spec. Greenfield build. Tuned to the `/h2k-coder-review`
> rubric (6 weighted parameters + hard submission gates) — see "Judging Alignment" at the end.

## Context

Students preparing for NEET/JEE/CUET/CAT/GATE/UPSC face months of high-stakes pressure,
burnout, and isolation. Generic mood trackers capture a number on a scale; they never read
the student's own words, so they miss *why* stress spikes (a specific subject, a mock-test
rank drop, family expectation, sleep collapse). **MindLog** is a GenAI companion where a
student journals freely and logs mood, an AI extracts hidden stress triggers and emotional
patterns across time, and responds with personalized coping strategies drawn from a
self-growing exercise library — with a hard safety layer for crisis signals.

**Vertical / persona (PromptWars mandatory):** Indian competitive-exam aspirants (school +
post-grad: NEET/JEE/CUET/CAT/GATE/UPSC), age ~16–26, under sustained academic stress.

## Goal / Definition of Done

A deployed, multi-user web app where a logged-in student can:
journal + log mood → receive a **streaming** AI analysis (triggers, emotions, patterns) →
get a personalized, library-backed coping/mindfulness exercise → talk to an empathetic chat
companion → see mood/trigger trends over time, with crisis detection that routes to real
helplines and never tries to "treat" acute risk. README complete (4 mandatory sections),
public repo, single branch, <10 MB, CI green.

## Stack (locked)

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript (strict) |
| Styling | Tailwind CSS |
| Validation | **Zod — single source of truth.** TS types are `z.infer`red from schemas; the same schema validates API I/O, Gemini structured output, and DB writes. No hand-maintained duplicate shapes. |
| AI | Google Gemini API (**`@google/genai`** — current unified SDK, NOT legacy `@google/generative-ai`), streaming + structured output |
| Models | `gemini-2.0-flash` for analysis + chat + exercise generation (confirm latest fast tier at build time); deterministic keyword pass for the safety backstop (no model call) |
| Auth + DB | Supabase (Postgres + Row-Level Security). **1hr-clock decision: skip real signup/email-confirm — use a single seeded demo session (fixed demo `user_id`), but keep RLS policies ON** so per-user isolation is real and testable. |
| Data access | **`supabase-js` + `supabase gen types`** for row types; Zod validates every boundary. **No Drizzle** (one fewer abstraction; gen-types + Zod already give type-safety). |
| Rate limit | **Supabase Postgres counter** — persistent, survives serverless cold starts. **No Upstash** (avoid a second hosted service/secret under the clock). No in-memory limiter. |
| Deploy | Vercel (app) + Supabase (data) |
| Tests | Vitest (unit + route/orchestration) + Playwright (E2E) + coverage; GitHub Actions CI |

## Architecture

```
Browser (React Server + Client Components)
  │  journal + mood form, streaming UI, trends, chat
  ▼
Next.js Route Handlers  (/app/api/*)
  ├─ POST /api/entries   → orchestrates: validate → analyze(+risk in one call)
  │                         → if acute: crisis path  else: recommend exercise
  ├─ GET  /api/entries   → history (RLS-scoped)
  ├─ POST /api/chat      → streaming companion (ReadableStream)
  ├─ POST /api/feedback  → exercise effectiveness → updates library stats
  └─ GET  /api/trends    → aggregated mood/trigger series
  │
  ├─ lib/ai/gemini.ts          → Gemini client (stream + structured, maxOutputTokens capped)
  ├─ lib/safety/classifier.ts  → deterministic keyword/regex backstop (cheap, no LLM)
  ├─ lib/library/recommend.ts  → match existing exercise OR generate+validate+persist
  ├─ lib/ratelimit.ts          → persistent limiter (Upstash/Postgres)
  └─ lib/schemas/*.ts          → Zod schemas (THE single source of truth)
  ▼
Supabase Postgres (RLS per user) + Gemini API
```

### Efficiency note — one analysis call, not three

The journal analysis returns triggers, emotions, themes, AND a `risk_level` in a **single**
Gemini structured-output call. The deterministic keyword/regex pass is a separate cheap
non-LLM signal layered on top (defense in depth). Exercise *delivery* personalization reuses
the analysis result rather than making a fresh call. This avoids the "redundant LLM calls"
efficiency ding: one model call per entry on the happy path, a second only when a brand-new
exercise must be generated.

### The self-growing exercise library (core differentiator)

On each analyzed entry:
1. **Match:** retrieve candidate exercises from `coping_exercises` whose `addresses_triggers`
   overlap the detected triggers (MVP: tag overlap + text similarity; stretch: pgvector
   embedding match), `status='active'`, ranked by `match_score × avg_effectiveness`.
2. **Reuse:** if best match ≥ threshold → personalize *delivery* (framing for this
   student/trigger) from the existing analysis, recommend it, increment `usage_count`.
3. **Generate:** if no candidate clears the threshold → Gemini generates a new structured
   exercise (title, technique, steps, pros, evidence basis, addresses_triggers).
4. **Validate before serving:** the new exercise passes a validation gate — Zod shape check,
   safety check (no harmful/medical advice), and dedup check (not a near-duplicate of an
   existing exercise) — then inserts (`source='ai_generated'`, `status='active'`), is
   recommended, and becomes available to all future users. Library grows and gets smarter.
5. **Learn:** `POST /api/feedback` (helpful? rating?) updates `avg_effectiveness`; exercises
   that consistently underperform auto-`retire`. Seed with ~8 curated exercises so cold-start
   is never AI-only.

### Safety layer (non-negotiable)

- Every entry gets a `risk_level ∈ {none, elevated, acute}` from **both** the analysis call's
  structured output **and** a deterministic high-risk keyword/regex backstop — either source
  can trip the crisis path (a model miss still trips resources).
- On `acute`: short-circuit the normal coping flow. Render `CrisisResourceBanner` with India
  helplines — **KIRAN 1800-599-0019**, **Tele-MANAS 14416**, **AASRA +91-9820466726**,
  **iCall +91-9152987821** (tappable `tel:` links) — a grounding message, and a prompt to reach
  a trusted adult/professional. Write a `crisis_events` row.
- **Chat input is scanned too (research-driven gap fix).** `POST /api/chat` runs the same
  keyword backstop on every user message — students vent in chat, not only journals. On a hit,
  the companion **hard-stops and escalates** to the crisis banner; it must NEVER attempt to
  "treat" acute risk (Youper/Wysa norm; Replika's failure to escalate is the cautionary tale).
- **Always-visible SOS (category table-stakes — Wysa).** A persistent `SosButton` reachable from
  **every** screen (not only on detection) opens the helplines + a grounding step on demand.
- Persistent disclaimer on every screen: MindLog is a supportive companion, **not** a medical
  or clinical service — **not for emergencies**, not a substitute for professional care. Includes
  a one-line **privacy/confidentiality** note (entries are private to the user).

## Market-Informed Features (competitive research — build these)

Benchmarked against Daylio, Reflectly, Finch, Stoic, How We Feel, Wysa, Woebot, Youper,
Amaha/InnerHour, YourDOST. The features below are what users rave about and judges expect; each
is cheap in a GenAI web app. **P0 = build in the hour; P1 = stretch if time remains.**

| # | Feature | Pri | Where it lives | Why it fits exam aspirants |
|---|---------|-----|----------------|----------------------------|
| 1 | **AI guided journal prompts** (Reflectly/Stoic) — contextual sentence-starters when the page is blank, tailored to `exam_track` + recent mood (e.g. "Which subject drained you most today?") | P0 | `PromptSuggestion` component; cheap Gemini call or a seeded prompt bank keyed by mood/track | Kills blank-page paralysis for time-starved students |
| 2 | **Pattern / correlation insights** (Daylio/Youper) — `/api/trends` returns not just top triggers but 1–3 plain-language **insight statements** ("Your mood dips on days you mention *mock test*") | P0 | extend `GET /api/trends` + `InsightCard`; heuristic group-by over entries, optional 1 LLM digest | This IS the problem statement — "patterns standard trackers miss" |
| 3 | **Emotion-granularity picker** (How We Feel) — a curated nuanced-emotion chip set ("anxious / overwhelmed / burnt-out / numb") feeding `mood_tags` | P0 | `MoodSelector` / `EmotionPicker`; reuses existing `mood_tags text[]` | Precise naming → better-targeted coping |
| 4 | **Always-visible SOS** + **chat crisis scan** (Wysa) | P0 | `SosButton` (global) + `/api/chat` backstop — see Safety layer | Table-stakes safety; raises Security score |
| 5 | **Shame-free streak** (Finch) — gentle streak, missing a day = soft nudge never guilt | P0 | `StreakBadge` (already specced) — just frame it shame-free | Matches months-long prep cycles |
| 6 | **Evidence-based framing** (Wysa/Youper) — surface each exercise's `evidence_basis` label (CBT/grounding/breathing) | P0 | `ExerciseCard` (field already exists) | Credibility; not "canned tips" |
| 7 | **Co-created safety plan** (Wysa) — generated reasons-to-stay / calming activities / trusted contact | P1 | crisis flow extension | Above-category safety depth |
| 8 | **Weekly "wrapped" digest** (Daylio) — LLM summary of the week's entries | P1 | trends page; 1 extra LLM call | Momentum + self-awareness |
| 9 | **AM-prep / PM-reflection cadence** (Stoic) — two prompt presets by time of day | P1 | prompt presets in `JournalEditor` | Fits the study-day rhythm |

## Data Model (Supabase Postgres — RLS on every user-scoped table)

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  exam_track text check (exam_track in ('NEET','JEE','CUET','CAT','GATE','UPSC','OTHER')),
  created_at timestamptz default now()
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  mood_score int not null check (mood_score between 1 and 5),
  mood_tags text[] default '{}',
  created_at timestamptz default now()
);

create table entry_analyses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references journal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  triggers jsonb not null default '[]',   -- [{label, evidence_span, confidence}]
  emotions jsonb not null default '[]',   -- [{label, intensity}]
  themes jsonb not null default '[]',
  risk_level text not null check (risk_level in ('none','elevated','acute')),
  summary text,
  model text,
  created_at timestamptz default now()
);

-- GLOBAL growing library (NOT user-scoped; writes via service role only)
create table coping_exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  technique text not null,                -- 'box-breathing','5-4-3-2-1','cognitive-reframe'...
  category text not null,                 -- 'breathing','grounding','study-reframe','sleep','motivation'
  addresses_triggers text[] not null default '{}',
  steps jsonb not null,                   -- ordered step list
  pros text,
  evidence_basis text,
  source text not null check (source in ('curated','ai_generated')),
  status text not null default 'active' check (status in ('active','pending_review','retired')),
  usage_count int not null default 0,
  avg_effectiveness numeric(3,2) default 0,
  created_at timestamptz default now()
);

create table exercise_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid references journal_entries(id) on delete set null,
  exercise_id uuid not null references coping_exercises(id),
  reason text,
  created_at timestamptz default now()
);

create table exercise_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null references exercise_recommendations(id) on delete cascade,
  helpful boolean,
  rating int check (rating between 1 and 5),
  note text,
  created_at timestamptz default now()
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid references journal_entries(id) on delete set null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table crisis_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid references journal_entries(id) on delete set null,
  risk_level text not null,
  shown_resources jsonb,
  created_at timestamptz default now()
);
```

**RLS:** every user-scoped table gets `using (auth.uid() = user_id)` for select/insert/update/
delete. `coping_exercises` is readable by all authenticated users; writes happen server-side
via the service role only.

## Zod single-source schemas (`lib/schemas/`)

Defined once; reused for AI structured-output parsing, route validation, DB insert typing,
and client forms. **TS types are `z.infer`red — never hand-written alongside.**
- `JournalEntryInput` (body, mood_score 1–5, mood_tags)
- `EntryAnalysis` (triggers[], emotions[], themes[], risk_level, summary) — constrains Gemini
  output AND validates the DB row
- `CopingExercise` (title, technique, category, addresses_triggers[], steps[], pros,
  evidence_basis) — validates AI-generated exercises before persist
- `ChatTurn`, `FeedbackInput`, `TrendsResponse`

## API Contracts (selected)

```
POST /api/entries
  req:  JournalEntryInput
  flow: rate-limit → validate(Zod) → keyword backstop + gemini.analyze (one structured call)
        → if acute (either signal): persist + crisis_event + return {risk:'acute', resources}
        → else: persist analysis → library.recommend → persist recommendation
  res (stream): analysis tokens, then JSON tail { analysisId, recommendation }

POST /api/chat     → ReadableStream of assistant tokens (Gemini streaming); persists both turns
POST /api/feedback → { recommendationId, helpful, rating, note } → updates avg_effectiveness
GET  /api/trends   → { moodSeries[], topTriggers[], insights[], entryCount, streakDays }
                     insights[] = plain-language pattern statements ("mood dips on mock-test days")
```

All handlers: persistent rate limit, Zod-validated input AND model output, generic client
error messages (no stack/internal leakage), secrets server-side only (never `NEXT_PUBLIC_*`).

## Component Decomposition (`components/`)

No monolithic page component. Focused units: `JournalEditor`, `PromptSuggestion` (guided
prompts), `MoodSelector`, `EmotionPicker` (granular emotion chips), `AnalysisCard`,
`TriggerChips`, `ExerciseCard`, `ExercisePlayer` (step-by-step with breathing timer),
`ChatCompanion` (streaming), `TrendsChart`, `InsightCard` (pattern insights), `SosButton`
(global, always-visible), `CrisisResourceBanner`, `DisclaimerFooter`, `EmptyState`,
`StreakBadge`. Stable list keys (entry/exercise IDs, never array index).

## Accessibility Requirements

Semantic HTML; every input has a `<label>`; visible `:focus-visible` on all interactive
elements; decorative icons/emoji `aria-hidden`; async states use `aria-busy`/`aria-live`/
`role="alert"` (streaming analysis announces start/finish); AA contrast including small text;
forced-colors fallback for any gradient/clipped text; responsive, no fixed tiny fonts.

## Acceptance Criteria

1. A session is scoped to a user and only ever sees its own entries (under the clock: seeded
   demo `user_id`; RLS enforced). RLS test: a second user's row → cross-user read denied.
2. Submitting a journal entry returns a **streamed** analysis identifying ≥1 trigger with an
   evidence span quoted from the text.
3. After analysis, the app recommends a coping exercise; library match reuses an existing one,
   otherwise it generates → validates → persists a new one (verified: `coping_exercises` count
   increases only on the no-match path).
4. An entry with acute self-harm/suicidal content triggers the crisis path — coping flow
   skipped, India helplines shown, `crisis_events` row written — via **both** the model signal
   and the keyword backstop independently (two tests).
5. The chat companion streams responses token-by-token.
6. Submitting exercise feedback updates that exercise's `avg_effectiveness`.
7. Trends view shows mood over time and top recurring triggers across ≥3 entries.
8. Every screen shows the "not a clinical service" disclaimer.
9. No secrets in the repo; `.env.example` documents all keys; CI runs tests + coverage green.

## Testing Pyramid

| Layer | What | Count |
|-------|------|-------|
| Unit | Zod schema validation; `safety.classifier` keyword backstop; library match scorer; effectiveness aggregator | +8 |
| Integration (route/orchestration) | `POST /api/entries` success; validation 400; rate-limit 429; Gemini 5xx upstream; acute-crisis short-circuit; match-vs-generate branch; streaming `/api/chat`; RLS cross-user denial — **LLM mocked** | +8 |
| Component | `JournalEditor`, `ExercisePlayer`, `CrisisResourceBanner` smoke + interaction | +3 |
| E2E (Playwright) | signup → journal → streamed analysis → exercise → feedback → trends | +1 |

## Out of Scope (hackathon)

- **Real auth / signup / email-confirm — deferred under the 1hr clock.** Single seeded demo
  session (fixed demo `user_id`) instead; RLS policies stay ON so the isolation story is real.
- **Playwright E2E — time-permitting only.** Unit + route/orchestration (LLM mocked) + the RLS
  cross-user test gate CI; a flaky E2E must not red the CI compliance gate.
- Native mobile apps (web-responsive only).
- Voice/audio journaling (stretch; Gemini multimodal makes it a later add).
- Clinician dashboard / human-in-the-loop escalation beyond showing helplines.
- Real payment/subscription.
- Localization beyond English (India helplines included regardless).

## Risks / Rollback

- **AI latency hurts demo** → stream everything; skeleton states; cache the demo account's
  recent analyses.
- **Gemini structured-output drift** → Zod-parse with ONE targeted retry on parse failure (not
  a full re-generation); fall back to a safe templated response.
- **Self-growing library pollution (bad AI exercise persisted)** → validation gate +
  `pending_review` option + effectiveness-based auto-retire; ~8 curated seed exercises.
- **Rollback** = revert PR; data is additive, no destructive migrations.

---

## Judging Alignment — `/h2k-coder-review` rubric (target 110/100)

### Submission compliance gates (a violation voids the entire score)

- [ ] **Public repo**, **single branch only**, **< 10 MB** (gitignore `node_modules`/`.next`;
      no committed binaries/datasets).
- [ ] **No secrets tracked** — only `.env.example` is committed.
- [ ] **README has all 4 mandatory sections:** (1) chosen vertical/persona (exam aspirants),
      (2) approach & logic, (3) how the solution works, (4) assumptions made. Plus: architecture
      diagram, env vars, demo link/GIF, AI-usage notes.
- [ ] **ONE submission** — run `/h2k-coder-review` as the final gate, drive every category ≥95,
      ship the +10 moves, then submit once.

### How the build targets each weighted parameter

| # | Parameter (weight) | How this spec scores high |
|---|--------------------|---------------------------|
| 1 | **Code Quality (×3)** | No monolithic component (decomposition above); single source of truth (Zod-`infer`red types, one schema for I/O + AI + DB); stable list keys; strict TS; no dead code/console noise. |
| 2 | **Problem Statement Alignment (×3)** | Dynamic, not static — output changes with each journal entry; logical decision-making over the student's detected triggers/context; real, reachable end-to-end flow; Gemini is the actual engine; clear vertical (exam aspirants) stated in README. |
| 3 | **Security (×2)** | Supabase RLS per-user isolation at the DB layer; secrets server-side only (never `NEXT_PUBLIC`); Zod validation at every trust boundary **including model output before DB write**; persistent rate limiter (survives serverless); generic client errors; no `dangerouslySetInnerHTML`/`eval`/SSRF. |
| 4 | **Efficiency (×2)** | Stream model responses (`generateContentStream`); `maxOutputTokens` capped; `gemini-2.0-flash` tier for latency; ONE analysis call per entry (risk folded in); targeted retry not full re-generation; library reuse avoids regenerating known exercises. |
| 5 | **Testing (×1)** | Route/handler branch tests (success/400/429/5xx); orchestration test with LLM mocked exercising the real flow + crisis path; component smoke tests; coverage signal + GitHub Actions CI. |
| 6 | **Accessibility (×1)** | Semantic HTML, labelled inputs, `:focus-visible`, `aria-hidden` decorative, `aria-live`/`role=alert` for streaming async, AA contrast incl. small text, forced-colors fallback, responsive. |

### Above-and-beyond (the +10)

Streamed token-by-token analysis + chat; the **self-growing exercise library** that visibly
learns over time; deterministic + model dual-signal crisis safety **with always-visible SOS and
chat-input scanning** (category table-stakes most baselines miss); **AI guided journaling prompts**
that beat the blank page; a polished trends view with **real correlation insights** ("mood dips on
mock-test days"); an **emotion-granularity picker**; a clean seeded demo account. These exceed a
static "journal → canned tip" baseline the evaluator expects.

---

_Spec authored via `/spec`. Build, then run `/h2k-coder-review` before the single submission._
