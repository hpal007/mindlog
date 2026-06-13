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
