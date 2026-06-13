-- ============================================================================
-- 0005_atomic_usage.sql — atomic usage_count increment for coping exercises
--
-- usage_count is a soft popularity signal, but the previous SELECT-then-UPDATE
-- read-modify-write took two round-trips and was vulnerable to a lost-update
-- race under concurrency. This helper folds the bump into a single atomic SQL
-- statement: the increment happens in-place in the database, so no value is
-- read into the app and no concurrent recommendation can clobber another.
-- ============================================================================

create or replace function increment_exercise_usage(p_exercise_id uuid)
returns void
language sql
as $$
  update coping_exercises
     set usage_count = usage_count + 1
   where id = p_exercise_id;
$$;
