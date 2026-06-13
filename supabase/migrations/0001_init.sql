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
