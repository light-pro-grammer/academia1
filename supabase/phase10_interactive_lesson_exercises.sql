-- Interactive lesson exercises with keyword-based checking.
-- Run this on existing Supabase projects after phase9.

create table if not exists public.lesson_exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  title text not null,
  prompt text not null,
  required_keywords jsonb not null default '[]'::jsonb,
  explanation text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lesson_exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  passed boolean not null default false,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists lesson_exercises_lesson_order_idx
on public.lesson_exercises(lesson_id, order_index);

create index if not exists lesson_exercise_attempts_user_lesson_idx
on public.lesson_exercise_attempts(user_id, lesson_id, created_at desc);

alter table public.lesson_exercises enable row level security;
alter table public.lesson_exercise_attempts enable row level security;

drop policy if exists "Lesson exercises are readable by everyone" on public.lesson_exercises;
create policy "Lesson exercises are readable by everyone"
on public.lesson_exercises for select
using (true);

drop policy if exists "Admins can manage lesson exercises" on public.lesson_exercises;
create policy "Admins can manage lesson exercises"
on public.lesson_exercises for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own lesson exercise attempts" on public.lesson_exercise_attempts;
create policy "Users can read own lesson exercise attempts"
on public.lesson_exercise_attempts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own lesson exercise attempts" on public.lesson_exercise_attempts;
create policy "Users can create own lesson exercise attempts"
on public.lesson_exercise_attempts for insert
to authenticated
with check (auth.uid() = user_id);
