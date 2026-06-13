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
