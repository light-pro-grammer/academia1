create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  question text not null,
  type text not null check (type in ('multiple_choice', 'true_false', 'open_text')),
  options jsonb,
  correct_answer text not null,
  explanation text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  answer text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  description text,
  pass_score integer not null default 70 check (pass_score between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question text not null,
  type text not null check (type in ('multiple_choice', 'true_false')),
  options jsonb not null,
  correct_answer text not null,
  explanation text,
  order_index integer not null default 0
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  answers jsonb not null,
  completed_at timestamptz not null default now()
);

create index if not exists exercises_lesson_order_idx on public.exercises(lesson_id, order_index);
create index if not exists exercise_results_user_lesson_idx on public.exercise_results(user_id, lesson_id, created_at desc);
create index if not exists exams_subject_idx on public.exams(subject_id);
create index if not exists exam_questions_exam_order_idx on public.exam_questions(exam_id, order_index);
create index if not exists exam_attempts_user_idx on public.exam_attempts(user_id, completed_at desc);

alter table public.exercises enable row level security;
alter table public.exercise_results enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;

drop policy if exists "Exercises are readable by everyone" on public.exercises;
create policy "Exercises are readable by everyone"
on public.exercises for select
using (true);

drop policy if exists "Admins can manage exercises" on public.exercises;
create policy "Admins can manage exercises"
on public.exercises for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own exercise results" on public.exercise_results;
create policy "Users can read own exercise results"
on public.exercise_results for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own exercise results" on public.exercise_results;
create policy "Users can insert own exercise results"
on public.exercise_results for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Exams are readable by everyone" on public.exams;
create policy "Exams are readable by everyone"
on public.exams for select
using (true);

drop policy if exists "Admins can manage exams" on public.exams;
create policy "Admins can manage exams"
on public.exams for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Exam questions are readable by everyone" on public.exam_questions;
create policy "Exam questions are readable by everyone"
on public.exam_questions for select
using (true);

drop policy if exists "Admins can manage exam questions" on public.exam_questions;
create policy "Admins can manage exam questions"
on public.exam_questions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read own exam attempts" on public.exam_attempts;
create policy "Users can read own exam attempts"
on public.exam_attempts for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own exam attempts" on public.exam_attempts;
create policy "Users can insert own exam attempts"
on public.exam_attempts for insert
to authenticated
with check (auth.uid() = user_id);
