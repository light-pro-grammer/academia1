create extension if not exists "pgcrypto";

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.lessons
add column if not exists course_id uuid references public.courses(id) on delete set null;

create index if not exists courses_subject_order_idx on public.courses(subject_id, order_index);
create index if not exists courses_slug_idx on public.courses(slug);
create index if not exists lessons_course_status_idx on public.lessons(course_id, status);

alter table public.courses enable row level security;

drop policy if exists "Courses are readable by everyone" on public.courses;
create policy "Courses are readable by everyone"
on public.courses for select
using (true);

drop policy if exists "Admins can manage courses" on public.courses;
create policy "Admins can manage courses"
on public.courses for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Authenticated users can create pending lessons" on public.lessons;
drop policy if exists "Authenticated users can create lessons" on public.lessons;
create policy "Authenticated users can create lessons"
on public.lessons for insert
to authenticated
with check (
  auth.uid() = author_id
  and (
    status = 'pending'
    or (status = 'approved' and public.is_admin())
  )
);

drop policy if exists "Authors can update own lessons for remoderation" on public.lessons;
create policy "Authors can update own lessons for remoderation"
on public.lessons for update
to authenticated
using (auth.uid() = author_id)
with check (
  auth.uid() = author_id
  and status = 'pending'
);

insert into public.subjects (title, slug, description, icon)
values
  ('Біологія', 'biolohiia', 'Клітини, спадковість, еволюція, екосистеми та будова живих організмів.', 'dna')
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon;

with course_seed(subject_slug, title, slug, order_index) as (
  values
    ('matematyka', 'Вступ до алгебри', 'vstup-do-alhebry', 1),
    ('matematyka', 'Алгебра', 'alhebra', 2),
    ('matematyka', 'Геометрія та тригонометрія', 'heometriia-ta-tryhonometriia', 3),
    ('matematyka', 'Функції та вступ до матаналізу', 'funktsii-ta-vstup-do-matanalizu', 4),
    ('matematyka', 'Математичний аналіз', 'matematychnyi-analiz', 5),
    ('matematyka', 'Лінійна алгебра', 'liniina-alhebra', 6),
    ('matematyka', 'Теорія ймовірностей та статистика', 'teoriia-ymovirnostei-ta-statystyka', 7),
    ('matematyka', 'Дискретна математика та логіка', 'dyskretna-matematyka-ta-lohika', 8),
    ('matematyka', 'Диференціальні рівняння', 'dyferentsialni-rivniannia', 9),
    ('matematyka', 'Аналіз функцій дійсної змінної та поглиблені теми', 'analiz-funktsii-diisnoi-zminnoi-ta-pohlybleni-temy', 10),
    ('fizyka', 'Механіка', 'mekhanika', 1),
    ('fizyka', 'Термодинаміка', 'termodynamika', 2),
    ('fizyka', 'Електромагнетизм', 'elektromahnetyzm', 3),
    ('fizyka', 'Оптика та хвилі', 'optyka-ta-khvyli', 4),
    ('fizyka', 'Квантова фізика', 'kvantova-fizyka', 5),
    ('fizyka', 'Теорія відносності', 'teoriia-vidnosnosti', 6),
    ('khimiia', 'Загальна хімія', 'zahalna-khimiia', 1),
    ('khimiia', 'Неорганічна хімія', 'neorhanichna-khimiia', 2),
    ('khimiia', 'Органічна хімія', 'orhanichna-khimiia', 3),
    ('khimiia', 'Фізична хімія', 'fizychna-khimiia', 4),
    ('khimiia', 'Біохімія', 'biokhimiia', 5),
    ('biolohiia', 'Клітинна біологія', 'klitynna-biolohiia', 1),
    ('biolohiia', 'Генетика', 'henetyka', 2),
    ('biolohiia', 'Еволюція', 'evoliutsiia', 3),
    ('biolohiia', 'Екологія', 'ekolohiia', 4),
    ('biolohiia', 'Анатомія і фізіологія', 'anatomiia-i-fiziolohiia', 5),
    ('biolohiia', 'Мікробіологія', 'mikrobiolohiia', 6)
)
insert into public.courses (subject_id, title, slug, order_index)
select subjects.id, course_seed.title, course_seed.slug, course_seed.order_index
from course_seed
join public.subjects on subjects.slug = course_seed.subject_slug
on conflict (slug) do update set
  subject_id = excluded.subject_id,
  title = excluded.title,
  order_index = excluded.order_index;
