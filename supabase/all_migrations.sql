-- ==== supabase/migrations/0001_init.sql ====
-- ============================================================================
-- 0001_init.sql — MindLog schema (Supabase Postgres)
-- All user-scoped tables reference auth.users so RLS via auth.uid() is real and
-- testable (see 0002_rls.sql). The coping_exercises library is GLOBAL (not
-- user-scoped) and grows over time (curated seed + ai_generated).
-- ============================================================================

-- gen_random_uuid() is provided by the pgcrypto extension (preinstalled on
-- Supabase, but enable defensively for portability).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles — one row per user (id == auth.users.id)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  exam_track   text check (exam_track in ('NEET','JEE','CUET','CAT','GATE','UPSC','OTHER')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- journal_entries — the student's free-text journal + mood log
-- ---------------------------------------------------------------------------
create table if not exists journal_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  mood_score int  not null check (mood_score between 1 and 5),
  mood_tags  text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists journal_entries_user_created_idx
  on journal_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- entry_analyses — one structured Gemini analysis per entry
--   triggers jsonb: [{label, evidence_span, confidence}]
--   emotions jsonb: [{label, intensity}]
--   themes   jsonb: ["..."]
-- ---------------------------------------------------------------------------
create table if not exists entry_analyses (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references journal_entries(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  triggers   jsonb not null default '[]',
  emotions   jsonb not null default '[]',
  themes     jsonb not null default '[]',
  risk_level text  not null check (risk_level in ('none','elevated','acute')),
  summary    text,
  model      text,
  created_at timestamptz not null default now()
);
create index if not exists entry_analyses_user_created_idx
  on entry_analyses (user_id, created_at desc);
create index if not exists entry_analyses_entry_idx
  on entry_analyses (entry_id);

-- ---------------------------------------------------------------------------
-- coping_exercises — GLOBAL self-growing library (NOT user-scoped)
--   steps jsonb: [{order, text, seconds?}]
--   writes happen server-side via the service role only (see 0002_rls.sql)
-- ---------------------------------------------------------------------------
create table if not exists coping_exercises (
  id                 uuid primary key default gen_random_uuid(),
  slug               text unique not null,
  title              text not null,
  technique          text not null,
  category           text not null check (category in ('breathing','grounding','study-reframe','sleep','motivation')),
  addresses_triggers text[] not null default '{}',
  steps              jsonb not null,
  pros               text,
  evidence_basis     text,
  source             text not null check (source in ('curated','ai_generated')),
  status             text not null default 'active' check (status in ('active','pending_review','retired')),
  usage_count        int not null default 0,
  avg_effectiveness  numeric(3,2) not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists coping_exercises_status_idx
  on coping_exercises (status);

-- ---------------------------------------------------------------------------
-- exercise_recommendations — which exercise was recommended for which entry
-- ---------------------------------------------------------------------------
create table if not exists exercise_recommendations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entry_id    uuid references journal_entries(id) on delete set null,
  exercise_id uuid not null references coping_exercises(id),
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists exercise_recommendations_user_idx
  on exercise_recommendations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- exercise_feedback — effectiveness signal feeding avg_effectiveness
-- ---------------------------------------------------------------------------
create table if not exists exercise_feedback (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null references exercise_recommendations(id) on delete cascade,
  helpful           boolean,
  rating            int check (rating between 1 and 5),
  note              text,
  created_at        timestamptz not null default now()
);
create index if not exists exercise_feedback_rec_idx
  on exercise_feedback (recommendation_id);

-- ---------------------------------------------------------------------------
-- chat_messages — companion conversation, both user + assistant turns
-- ---------------------------------------------------------------------------
create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_id   uuid references journal_entries(id) on delete set null,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_user_created_idx
  on chat_messages (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- crisis_events — audit row written whenever the crisis path trips
-- ---------------------------------------------------------------------------
create table if not exists crisis_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  entry_id        uuid references journal_entries(id) on delete set null,
  risk_level      text not null,
  shown_resources jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists crisis_events_user_idx
  on crisis_events (user_id, created_at desc);

-- ==== supabase/migrations/0002_rls.sql ====
-- ============================================================================
-- 0002_rls.sql — Row-Level Security
--
-- WHY RLS IS ON EVEN THOUGH THE APP USES THE SERVICE ROLE:
--   Under the 1hr clock we skip real signup and run a single seeded demo
--   session (a fixed DEMO_USER_ID). The Next.js routes therefore talk to
--   Postgres with the SERVICE-ROLE key, which BYPASSES RLS, and scope every
--   query by an explicit user_id in application code (see lib/db/supabase-data.ts).
--
--   We still enable RLS with correct per-user policies so the per-user
--   isolation security story is REAL and TESTABLE: the Lane E cross-user
--   denial test connects with the ANON key, signs in / impersonates a user
--   (a JWT whose sub == that user_id), and proves it cannot read another
--   user's rows. With RLS off, that test would (wrongly) pass through. RLS on
--   + correct policies = a genuine, graded security boundary, not decoration.
--
-- Policy shape: `auth.uid() = user_id` for select/insert/update/delete on
-- every user-scoped table. The global coping_exercises library is readable by
-- all authenticated users; writes are service-role only (no anon/authenticated
-- write policy => the service role, which bypasses RLS, is the only writer).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles (id IS the user id here, so policies key off id)
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;

create policy profiles_select on profiles
  for select using (auth.uid() = id);
create policy profiles_insert on profiles
  for insert with check (auth.uid() = id);
create policy profiles_update on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_delete on profiles
  for delete using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- journal_entries
-- ---------------------------------------------------------------------------
alter table journal_entries enable row level security;

create policy journal_entries_select on journal_entries
  for select using (auth.uid() = user_id);
create policy journal_entries_insert on journal_entries
  for insert with check (auth.uid() = user_id);
create policy journal_entries_update on journal_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy journal_entries_delete on journal_entries
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- entry_analyses
-- ---------------------------------------------------------------------------
alter table entry_analyses enable row level security;

create policy entry_analyses_select on entry_analyses
  for select using (auth.uid() = user_id);
create policy entry_analyses_insert on entry_analyses
  for insert with check (auth.uid() = user_id);
create policy entry_analyses_update on entry_analyses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy entry_analyses_delete on entry_analyses
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- coping_exercises — GLOBAL library.
--   Read: any authenticated user. Write: SERVICE ROLE ONLY (no write policy
--   is defined for anon/authenticated, so RLS denies their writes; the
--   service-role client bypasses RLS and is the sole writer).
-- ---------------------------------------------------------------------------
alter table coping_exercises enable row level security;

create policy coping_exercises_select on coping_exercises
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- exercise_recommendations
-- ---------------------------------------------------------------------------
alter table exercise_recommendations enable row level security;

create policy exercise_recommendations_select on exercise_recommendations
  for select using (auth.uid() = user_id);
create policy exercise_recommendations_insert on exercise_recommendations
  for insert with check (auth.uid() = user_id);
create policy exercise_recommendations_update on exercise_recommendations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy exercise_recommendations_delete on exercise_recommendations
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- exercise_feedback
-- ---------------------------------------------------------------------------
alter table exercise_feedback enable row level security;

create policy exercise_feedback_select on exercise_feedback
  for select using (auth.uid() = user_id);
create policy exercise_feedback_insert on exercise_feedback
  for insert with check (auth.uid() = user_id);
create policy exercise_feedback_update on exercise_feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy exercise_feedback_delete on exercise_feedback
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
alter table chat_messages enable row level security;

create policy chat_messages_select on chat_messages
  for select using (auth.uid() = user_id);
create policy chat_messages_insert on chat_messages
  for insert with check (auth.uid() = user_id);
create policy chat_messages_update on chat_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy chat_messages_delete on chat_messages
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- crisis_events
-- ---------------------------------------------------------------------------
alter table crisis_events enable row level security;

create policy crisis_events_select on crisis_events
  for select using (auth.uid() = user_id);
create policy crisis_events_insert on crisis_events
  for insert with check (auth.uid() = user_id);
create policy crisis_events_update on crisis_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy crisis_events_delete on crisis_events
  for delete using (auth.uid() = user_id);

-- ==== supabase/migrations/0003_seed.sql ====
-- ============================================================================
-- 0003_seed.sql — demo session user + curated coping_exercises library
--
-- The demo profile FKs to auth.users(id), so we first ensure a matching
-- auth.users row exists for DEMO_USER_ID. This is the seeded demo session
-- (no real signup under the 1hr clock). Idempotent via on conflict do nothing.
-- ============================================================================

-- Seed the demo auth user so the profiles FK is satisfiable.
-- (instance_id + the minimal NOT NULL columns Supabase's GoTrue expects.)
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'demo@mindlog.app',
  '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}', false
)
on conflict (id) do nothing;

-- Demo profile.
insert into profiles (id, display_name, exam_track)
values ('00000000-0000-0000-0000-000000000001', 'Demo Student', 'NEET')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Curated coping library (source='curated', status='active').
-- steps jsonb matches exerciseStepSchema: {order, text, seconds?}.
-- addresses_triggers are lowercase tags the matcher overlaps against detected
-- trigger labels. avg_effectiveness seeded > 0 so curated items rank ahead of
-- brand-new ai_generated ones at cold start.
-- ---------------------------------------------------------------------------
insert into coping_exercises
  (slug, title, technique, category, addresses_triggers, steps, pros, evidence_basis, source, status, avg_effectiveness)
values
-- 1. Breathing — box breathing for acute pre-exam panic
('box-breathing', 'Box Breathing to Steady Exam Nerves', 'box-breathing', 'breathing',
 array['exam anxiety','test anxiety','panic','racing thoughts','overwhelm'],
 '[{"order":1,"text":"Sit upright, relax your shoulders, and rest your hands in your lap.","seconds":10},
   {"order":2,"text":"Breathe in slowly through your nose for 4 counts.","seconds":4},
   {"order":3,"text":"Hold your breath gently for 4 counts.","seconds":4},
   {"order":4,"text":"Breathe out slowly through your mouth for 4 counts.","seconds":4},
   {"order":5,"text":"Hold empty for 4 counts, then repeat the square four more times.","seconds":4}]'::jsonb,
 'Fast to learn, works anywhere (even outside the exam hall), and calms a racing heart within a minute.',
 'breathing / autonomic down-regulation', 'curated', 'active', 4.30),

-- 2. Grounding — 5-4-3-2-1 sensory reset
('5-4-3-2-1-grounding', '5-4-3-2-1 Grounding When Thoughts Spiral', '5-4-3-2-1', 'grounding',
 array['racing thoughts','overwhelm','panic','dissociation','anxiety','intrusive thoughts'],
 '[{"order":1,"text":"Name 5 things you can SEE around you right now."},
   {"order":2,"text":"Name 4 things you can FEEL (your feet on the floor, the chair, your pen)."},
   {"order":3,"text":"Name 3 things you can HEAR."},
   {"order":4,"text":"Name 2 things you can SMELL."},
   {"order":5,"text":"Name 1 thing you can TASTE, then take one slow breath."}]'::jsonb,
 'Pulls your attention out of an anxious spiral and back into the present in under two minutes.',
 'grounding / CBT distress-tolerance', 'curated', 'active', 4.10),

-- 3. Study-reframe — cognitive reframe for mock-test rank anxiety
('mock-rank-reframe', 'Reframing a Bad Mock-Test Rank', 'cognitive-reframe', 'study-reframe',
 array['mock test','rank drop','low score','self-doubt','comparison','failure','results'],
 '[{"order":1,"text":"Write the exact thought that is hurting (e.g. \"My rank dropped, I will never crack NEET\")."},
   {"order":2,"text":"Underline the part that is a prediction, not a fact. A mock is a snapshot, not your final result."},
   {"order":3,"text":"List 2 things this mock actually told you: which topics to revise next."},
   {"order":4,"text":"Rewrite the thought as a next step: \"My rank dropped on this mock, so I will redo these 3 topics this week.\""},
   {"order":5,"text":"Read the new sentence out loud once."}]'::jsonb,
 'Turns a demoralising score into a concrete study plan and breaks the all-or-nothing thinking that fuels burnout.',
 'CBT / cognitive restructuring', 'curated', 'active', 4.40),

-- 4. Study-reframe — shrinking an overwhelming syllabus
('syllabus-chunking', 'Shrinking an Overwhelming Syllabus', 'task-chunking', 'study-reframe',
 array['syllabus','overwhelm','procrastination','too much to study','time pressure','backlog'],
 '[{"order":1,"text":"Pick ONE subject only. Close everything else."},
   {"order":2,"text":"Write the single next 25-minute task (one chapter, one problem set), not the whole syllabus."},
   {"order":3,"text":"Set a timer for 25 minutes and work only on that.","seconds":1500},
   {"order":4,"text":"Take a 5-minute break: stretch, water, look out a window.","seconds":300},
   {"order":5,"text":"Tick the task off and choose the next single 25-minute block."}]'::jsonb,
 'Replaces the paralysing \"everything at once\" feeling with one doable block, building momentum.',
 'behavioural activation / Pomodoro', 'curated', 'active', 4.00),

-- 5. Sleep — wind-down for a racing pre-exam mind
('sleep-wind-down', 'Wind-Down for a Racing Pre-Exam Mind', 'progressive-relaxation', 'sleep',
 array['insomnia','cannot sleep','racing thoughts','exam tomorrow','tiredness','sleep'],
 '[{"order":1,"text":"Put screens away and dim the lights 20 minutes before bed.","seconds":1200},
   {"order":2,"text":"Write tomorrow''s top 3 tasks on paper so your mind can let them go.","seconds":120},
   {"order":3,"text":"Lying down, tense your feet for 5 seconds, then release.","seconds":5},
   {"order":4,"text":"Work upward, tensing then releasing calves, thighs, hands, shoulders, jaw.","seconds":60},
   {"order":5,"text":"Breathe out longer than you breathe in (4 in, 6 out) until you drift off.","seconds":120}]'::jsonb,
 'Quiets a mind stuck on tomorrow''s exam and helps you fall asleep without lying awake counting losses.',
 'sleep-hygiene / progressive muscle relaxation', 'curated', 'active', 4.20),

-- 6. Motivation — exam-day morning anchor
('exam-day-anchor', 'Exam-Morning Confidence Anchor', 'self-affirmation', 'motivation',
 array['exam day','low confidence','self-doubt','nervous','exam anxiety','pressure'],
 '[{"order":1,"text":"Stand tall, plant your feet, and take three slow breaths.","seconds":15},
   {"order":2,"text":"Recall one past test or topic you DID prepare well. Picture it for a moment.","seconds":20},
   {"order":3,"text":"Say to yourself: \"I have prepared. I will read each question calmly and answer what I know first.\""},
   {"order":4,"text":"Decide your first move in the hall: read all instructions, attempt the easy questions first."},
   {"order":5,"text":"Take one final slow breath and walk in.","seconds":10}]'::jsonb,
 'Channels exam-morning adrenaline into a calm, concrete game plan instead of dread.',
 'sports-psychology / self-affirmation', 'curated', 'active', 4.15),

-- 7. Motivation — reconnecting with your reason
('reconnect-your-why', 'Reconnecting With Your Why', 'values-reflection', 'motivation',
 array['burnout','demotivation','loss of purpose','exhaustion','why am i doing this','hopeless'],
 '[{"order":1,"text":"Write one honest sentence: why did you start preparing for this exam?"},
   {"order":2,"text":"Name one person or future moment that this effort is for."},
   {"order":3,"text":"List 2 small things that have gone right this week, however tiny."},
   {"order":4,"text":"Choose ONE kind thing to do for yourself today (a walk, a call, a real meal)."},
   {"order":5,"text":"Set the smallest possible study goal for the next hour and start it."}]'::jsonb,
 'Refuels motivation from the inside when grind-fatigue makes the goal feel pointless.',
 'ACT / values-based activation', 'curated', 'active', 3.95),

-- 8. Grounding — soothing study-break for family-pressure stress
('parental-pressure-pause', 'A Pause When Family Expectations Feel Heavy', 'self-compassion', 'grounding',
 array['family pressure','parental expectations','comparison','guilt','disappointing parents','expectations'],
 '[{"order":1,"text":"Place a hand on your chest and feel it rise and fall for three breaths.","seconds":15},
   {"order":2,"text":"Acknowledge the feeling plainly: \"This pressure is real and it is heavy.\""},
   {"order":3,"text":"Separate their hopes from your worth: a result does not decide whether you matter."},
   {"order":4,"text":"Name one boundary or honest sentence you could say to a parent today."},
   {"order":5,"text":"Return to studying for their hopes AND your own, one task at a time."}]'::jsonb,
 'Eases the guilt and comparison that family expectations create, without dismissing real family bonds.',
 'self-compassion / CBT', 'curated', 'active', 4.05)
on conflict (slug) do nothing;

-- ==== supabase/migrations/0004_ratelimit.sql ====
-- ============================================================================
-- 0004_ratelimit.sql — persistent Postgres rate-limit counter
--
-- One row per (user_id, window_start) bucket. window_start is the floor of
-- now() to a fixed window (RATE_LIMIT_WINDOW_SECONDS). An atomic upsert
-- increments the bucket; the count is read back to decide allow/deny. Lives in
-- Postgres so it survives serverless cold starts (no in-memory limiter).
--
-- An atomic increment helper avoids a read-then-write race: it inserts the
-- bucket at count 1 or, on conflict, increments and returns the new count in a
-- single statement.
-- ============================================================================

create table if not exists rate_limits (
  user_id      uuid not null,
  window_start timestamptz not null,
  count        int not null default 0,
  primary key (user_id, window_start)
);

-- Atomic bump: insert-or-increment the bucket, return the resulting count.
create or replace function increment_rate_limit(p_user_id uuid, p_window_start timestamptz)
returns int
language sql
as $$
  insert into rate_limits (user_id, window_start, count)
  values (p_user_id, p_window_start, 1)
  on conflict (user_id, window_start)
    do update set count = rate_limits.count + 1
  returning count;
$$;

-- RLS on (defense in depth). Only the service role (which bypasses RLS) and
-- the function above ever touch this table; no anon/authenticated policy is
-- defined, so direct client access is denied.
alter table rate_limits enable row level security;

