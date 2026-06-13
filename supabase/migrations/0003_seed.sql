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
