# CLAUDE.md — PromptWars / Hackathon Playbook

Reusable project guide for **Hack2Skill × Google for Developers "PromptWars" / Build-with-AI**
hackathons (and similar one-shot, AI-judged hackathons). Drop this in the project root at the
start of a new build. Copy it verbatim, then fill in the `<< >>` blanks once the challenge drops.

---

## 0. The mission (read first)

- **Target is 110/100, not "done."** Max every judging category (=100), then exceed what the
  rubric asked for (the +10): streamed UX, delight, robustness past spec, an extra capability,
  clean demo + docs. "Good enough to ship" loses; "exactly what was asked" only ties.
- **There is ONE submission, no resubmit.** Get it to 110 locally, then submit once. Run the
  scorecard as the *final gate before the single shot*, never as a post-mortem.
- **Use the skills and subagents — don't hand-roll.** Parallelize independent work across
  subagents; use the gstack/h2k skills for review, scoring, and deploy.
- **Over-deliver by default.** After hitting a stated goal, proactively propose 2–4
  above-and-beyond moves and offer to ship them. Don't stop at the requirement.

## 0.5 SPRINT MODE — hard 1hr deadline (OVERRIDES the relaxed ethos above)

> Read this BEFORE §0's "boil the ocean / full pyramid / blog" guidance. Under the clock,
> a **working deployed demo beats a half-built "complete" one.** When sprint mode and the
> completeness ethos conflict, sprint mode wins until the demo is live end-to-end.

- **Demo-first ordering.** Get the happy path working and deployed EARLY, then harden. The one
  thing that must be true at minute 60: the public URL does journal → streamed analysis →
  exercise → chat → trends, with Gemini as the real engine and the crisis path proven.
- **Fan out subagents in parallel from minute 0** (single message, multiple `Agent` calls).
  Lanes are independent by design; merge points are the Zod schemas + the API contracts, so
  **lock `lib/schemas/*.ts` and the route signatures FIRST (5 min, main thread), then fan out:**
  - **Lane A — Data:** Supabase migrations (tables + RLS), seed ~8 curated exercises, seed the
    demo `user_id`, `lib/ratelimit.ts` (Postgres counter), `supabase gen types`.
  - **Lane B — AI core:** `lib/ai/gemini.ts` (`@google/genai`, ONE structured streaming call,
    `responseSchema` w/ a `reflection` field, token cap, 1 retry), `lib/safety/classifier.ts`
    (exam-idiom-aware keyword backstop), `lib/library/recommend.ts` (match-or-generate+validate).
  - **Lane C — Routes:** `app/api/{entries,chat,feedback,trends}/route.ts` against the locked
    schemas (streams as NDJSON/SSE; safety gate before any coping content).
  - **Lane D — UI:** decomposed `components/*` + pages; streaming UI, `ExercisePlayer`,
    `CrisisResourceBanner`, `DisclaimerFooter`, trends chart; a11y baked in (labels,
    `:focus-visible`, `aria-live`, `prefers-reduced-motion`).
  - **Lane E — Tests/CI/deploy:** Vitest unit + route (LLM mocked) + the RLS cross-user test
    (real Postgres in CI), `.env.example`, `.gitignore`, Vercel deploy. **Report conclusions
    only**, not file dumps.
- **Test budget under the clock:** unit (schemas, safety classifier incl. idiom false-positives,
  match scorer) + route/orchestration with LLM mocked (success / 400 / 429 / 5xx / acute-crisis /
  match-vs-generate) + the RLS denial test. **Skip Playwright E2E** unless the deploy is already
  green with time to spare — a flaky E2E can red the CI compliance gate.
- **Deferred to post-submission** (NOT in the hour): build-in-public blog, LinkedIn draft,
  pgvector dedup, real auth/signup, voice journaling.
- **Compliance gate is non-negotiable even under the clock** (§3): public repo, single branch,
  <10 MB, no secrets, README's 4 sections. A violation = 0 regardless of how good the code is.

## 1. Challenge context (LOCKED — MindLog)

- **Challenge:** Mental Wellness Tracker — GenAI companion that helps exam aspirants monitor
  and improve mental well-being during high-stakes boards/entrance prep.
- **Vertical / persona chosen:** Indian competitive-exam aspirants (NEET/JEE/CUET/CAT/GATE/UPSC),
  age ~16–26, under sustained academic stress.
- **Core ask (verbatim from problem.md):** analyze open-ended daily journaling + mood logs to
  uncover *hidden* stress triggers and emotional patterns standard trackers miss; use
  conversational AI for hyper-personalized, contextual support (tailored coping strategies,
  adaptive mindfulness, motivational encouragement); act safely as an empathetic, always-available
  companion.
- **Required outputs (build ALL, all real & reachable):** (1) streamed journal **analysis** —
  triggers w/ evidence spans, emotions, themes, risk_level — in ONE structured Gemini call;
  (2) a recommended **coping/mindfulness exercise** from the self-growing library (match-or-generate);
  (3) **streaming chat companion** grounded in the student's recent triggers; (4) **trends** —
  mood over time + top recurring triggers; (5) **crisis safety** — dual-signal (model + keyword
  backstop) → India helplines, never "treats" acute risk; (6) persistent **disclaimer** every screen.
- **Hard rule:** must be built with **Google Gemini** as the real engine (not decoration), via the
  **`@google/genai`** SDK (current unified SDK — NOT the legacy `@google/generative-ai`).

### Locked build decisions (this project)

- **Stack:** Next.js (App Router) + TS strict + Tailwind; **Supabase** (Postgres + RLS) + **Gemini**;
  Vitest. **No Upstash** (rate-limit via a Postgres counter). **No Drizzle** (`supabase-js` +
  `supabase gen types` + Zod as the single source of truth — `z.infer` all app types).
- **Auth under the 1hr clock:** **skip real signup/email-confirm.** Use a single **seeded demo
  session** (a fixed demo `user_id`), but keep **RLS policies on** so the per-user isolation
  security story is real and testable (cross-user-denial test against real Postgres).
- **Reference plan:** `~/.claude/plans/plan-ceo-review-check-this-code-swirling-sutton.md`
  (eng review + the 8 findings — resolve findings 1–7 as you build).

## 2. How you're judged (the 6 parameters + weights)

| # | Parameter | Impact | Weight |
|---|-----------|--------|--------|
| 1 | Code Quality | High | 3 |
| 2 | Problem Statement Alignment | High | 3 |
| 3 | Security | Medium | 2 |
| 4 | Efficiency | Medium | 2 |
| 5 | Testing | Low | 1 |
| 6 | Accessibility | Low | 1 |

`total = (CQ*3 + PSA*3 + SEC*2 + EFF*2 + TEST*1 + ACC*1) / 12 * 10`. A one-point gain on a
weight-3 category (Code Quality, Alignment) is worth 3× a Testing/Accessibility point — fix
high-weight gaps first. A real AI evaluator scores polished apps in the **80s** on Efficiency,
Code Quality, and Testing even when Security and Alignment hit 100 — those three are where the
points hide.

## 3. Submission compliance gates (a violation = NOT evaluated = 0)

Check these before submitting — failing any one voids the entire score regardless of code:
- [ ] Repo is **public**
- [ ] **Single branch only** (`git ls-remote --heads origin | wc -l` == 1)
- [ ] Repo **< 10 MB** (never commit `node_modules`/`.next`/`dist`/binaries; `.gitignore` them)
- [ ] **No secrets tracked** (`git ls-files | grep -i env` → only `.env.example`)
- [ ] **README** explains all four: (1) **chosen vertical/persona**, (2) **approach & logic**,
      (3) **how it works**, (4) **assumptions made**

## 4. What separates an 88 from a 100 (the strict-evaluator checklist)

**Code Quality → 100:** no monolithic 300+ line components (decompose into focused units);
single source of truth for shared shapes (derive TS types from the Zod schema — don't
hand-maintain the same shape in types + validation + LLM schema); stable list keys; no unused
imports / dead code.

**Alignment → 100:** every stated output real and reachable (not stubbed); a genuinely
**dynamic** assistant whose output changes with input; **context-driven decision logic**, not
echoing inputs; the mandated tool (Gemini) is the actual engine.

**Security → 100:** API key server-side only (never `NEXT_PUBLIC`, never in git/logs); validate
at every boundary — **input AND model output** (Zod both ways); no `dangerouslySetInnerHTML` /
`eval` / shell interpolation / SSRF; generic client errors; rate-limit paid endpoints; delimit
user text in prompts against injection.

**Efficiency → 100 (LLM apps):** **stream the response** (`generateContentStream`) — a multi-
second blank wait is the #1 ding; cap `maxOutputTokens`; right-size the model; **no redundant
full LLM re-calls** on retry; no unbounded in-memory growth; lean payloads/bundles.

**Testing → 100:** pure-logic unit tests alone cap you in the 80s. Add **API route tests**
(success / 400 / 429 / 5xx), an **orchestration test that mocks the LLM** (incl. retry/error
paths), at least smoke **component tests**, and a coverage/CI signal.

**Accessibility → 100:** semantic HTML; every input labelled; visible `:focus-visible` on all
interactive elements; `aria-hidden` on decorative icons/emoji; live regions for async state
(`aria-busy`/`aria-live`/`role=alert`); AA contrast incl. small text; forced-colors fallback for
gradient/clipped text; responsive, no fixed tiny fonts.

## 5. The proven workflow (run in this order)

> **Under the 1hr clock, §0.5 Sprint Mode overrides this.** Steps 1–2 are already done
> (problem.md + decisions locked); collapse 3–8 into the parallel subagent lanes and deploy
> early; steps 9 (blog/LinkedIn) is deferred to post-submission. Step 10 still runs.

1. **Research the criteria** (web) + capture the challenge verbatim into `problem.md`.
2. **Lock decisions** up front via one question round: stack, deploy target, repo, API key.
3. **Build** against the spec — implement ALL required outputs, real tool integration.
4. **Verify end-to-end** with a real API call before reviewing (don't review a broken app).
5. **Fan out parallel review subagents** (read/test-only, no file edits): code+security,
   functional QA against the live API, design/UX. Apply fixes yourself (serialized).
6. **Run `/h2k-coder-review`** — 6-subagent PromptWars scorecard → fix to 100 → +10 moves.
7. **Tests + build green**, then commit.
8. **Deploy** (Vercel) with the key set server-side; verify the **public** URL works end-to-end.
9. **Narrative**: README (4 required sections) + build-in-public blog + LinkedIn draft.
10. **Final compliance gate** (section 3) right before the single submission.

## 6. Tech defaults that worked

- **Next.js (App Router) + TypeScript strict**, deployed on **Vercel** (auto-redeploys on push
  to `main`; use the clean `*.vercel.app` domain — deployment-hash URLs are 401-protected).
- **Gemini via `@google/genai`**, server-side API route, **forced `responseSchema`** so the
  model returns a fixed structured shape every time (this is what makes it a "flow", not a blob).
- **Zod** for input validation AND output validation of the model response.
- **Trust-but-verify** any critical numbers/logic server-side (don't trust the model's math).
- **Vitest** for the pure logic; keep logic in a pure, exported module (`lib/*-logic.ts`) so
  it's testable without the network.
- Server-side-only secrets; `.env.local` gitignored; `.env.example` committed.

## 7. Skill routing (use these, don't hand-roll)

- **`frontend-design` skill — ALWAYS use this for any UI/UX work** (building screens,
  components, layout, styling, theming). Anthropic's official first-party design skill
  (`frontend-design@claude-code-plugins`, installed user-scope). It sets a deliberate design
  brief — purpose, audience, a specific aesthetic direction — *before* writing code, and avoids
  the AI-slop tells a strict evaluator dings: predictable purple gradients, generic system fonts,
  cookie-cutter components. This is the **generate** step; `/design-review` is the iterate step.
- `/h2k-coder-review` — PromptWars scorecard → fix to 110 (run as the final pre-submit gate)
- Parallel `Agent` subagents — independent review/QA/research tracks, run concurrently
- `/qa` or `/qa-only` — drive the live app, find functional bugs
- `/design-review` — visual polish, kill AI-slop UI (iterate on what `frontend-design` generated)
- `/code-review` — correctness + security pass on the diff
- `/land-and-deploy` or `/ship` — tests → commit → deploy → PR
- `/spec` is a backlog-ticketing tool — NOT the right lead for a time-boxed build.

## 8. Working preferences (durable)

- **Aim past the stated target.** When told "hit X," deliver beyond X and propose more.
- **Use subagents to parallelize** independent work; report only the conclusions.
- **Be decisive** — pick sensible defaults, state them, proceed; ask only genuinely blocking
  choices (API key, deploy target, repo).
- **Never commit secrets**; verify the public repo has no `.env*` before pushing.
