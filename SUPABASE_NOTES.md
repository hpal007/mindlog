# Supabase Setup Notes (MindLog)

## Migrations — run in order

The SQL lives in `supabase/migrations/`. Apply them **in numeric order**:

| File | What it does |
|------|--------------|
| `0001_init.sql` | Creates the 8 tables (profiles, journal_entries, entry_analyses, coping_exercises, exercise_recommendations, exercise_feedback, chat_messages, crisis_events) + indexes. |
| `0002_rls.sql` | Enables RLS on every table and adds `auth.uid() = user_id` policies. `coping_exercises` is read-all-authenticated, write-service-role-only. |
| `0003_seed.sql` | Seeds the demo auth user + `profiles` row (DEMO_USER_ID) and 8 curated coping exercises. |
| `0004_ratelimit.sql` | `rate_limits` table + atomic `increment_rate_limit()` function. |

### Option A — Supabase SQL Editor (fastest under the clock)

1. Open your project → **SQL Editor** → **New query**.
2. Paste the contents of `0001_init.sql`, run. Repeat for `0002`, `0003`, `0004` **in order**.

### Option B — Supabase CLI

```bash
supabase link --project-ref <your-project-ref>
supabase db push        # applies everything in supabase/migrations in order
```

## Generate row types (optional, for later)

Our `lib/db/types.ts` row types are hand-locked as the cross-lane contract. To
regenerate from the live schema instead:

```bash
supabase gen types typescript --project-id <project-id> > lib/db/generated-types.ts
```

## Required environment variables

Set these server-side (see `.env.example`). The service-role key is **server-only** — never `NEXT_PUBLIC_*`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DEMO_USER_ID` (defaults to `00000000-0000-0000-0000-000000000001`)

## Notes

- The app uses the **service-role client** and scopes every query by an explicit
  `user_id` (seeded demo session, no real auth under the 1hr clock). RLS stays
  **ON** so the cross-user isolation test (Lane E, run with the anon key) is a
  real, graded security boundary.
- `0003_seed.sql` seeds a row in `auth.users` so the `profiles` FK is satisfiable.
  If your project restricts direct `auth.users` inserts, create the demo user via
  the Supabase Auth dashboard with id `00000000-0000-0000-0000-000000000001`
  instead, then run only the `profiles` + exercises inserts.
- All seed/insert statements are idempotent (`on conflict do nothing`).
