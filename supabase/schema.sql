-- Academia consolidated Supabase schema snapshot.
-- Run this file once for a fresh Supabase project.
-- Historical phase*.sql files are kept as incremental migration history.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id) on delete cascade,
  title text not null,
  slug text not null unique,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lessons
add column if not exists course_id uuid references public.courses(id) on delete set null;

alter table public.lessons
add column if not exists order_index integer not null default 0;

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

create index if not exists subjects_slug_idx on public.subjects(slug);
create index if not exists courses_slug_idx on public.courses(slug);
create index if not exists courses_subject_order_idx on public.courses(subject_id, order_index);
create index if not exists lessons_slug_idx on public.lessons(slug);
create index if not exists lessons_subject_status_idx on public.lessons(subject_id, status);
create index if not exists lessons_course_status_idx on public.lessons(course_id, status);
create index if not exists lessons_course_order_idx on public.lessons(course_id, order_index);
create index if not exists lessons_author_idx on public.lessons(author_id);
create index if not exists progress_user_idx on public.progress(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lessons_set_updated_at on public.lessons;
create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    'user'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.subjects enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.progress enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
on public.profiles for select
using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Subjects are readable by everyone" on public.subjects;
create policy "Subjects are readable by everyone"
on public.subjects for select
using (true);

drop policy if exists "Admins can manage subjects" on public.subjects;
create policy "Admins can manage subjects"
on public.subjects for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

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

drop policy if exists "Approved lessons are public, owners and admins see own scope" on public.lessons;
create policy "Approved lessons are public, owners and admins see own scope"
on public.lessons for select
using (
  status = 'approved'
  or author_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Authenticated users can create pending lessons" on public.lessons;
drop policy if exists "Authenticated users can create lessons" on public.lessons;
drop policy if exists "Admins can create lessons" on public.lessons;
create policy "Admins can create lessons"
on public.lessons for insert
to authenticated
with check (
  auth.uid() = author_id
  and status = 'approved'
  and public.is_admin()
);

drop policy if exists "Authors can update own lessons for remoderation" on public.lessons;
drop policy if exists "Admins can moderate lessons" on public.lessons;
drop policy if exists "Admins can update lessons" on public.lessons;
create policy "Admins can update lessons"
on public.lessons for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete lessons" on public.lessons;
create policy "Admins can delete lessons"
on public.lessons for delete
to authenticated
using (public.is_admin());

drop policy if exists "Users can read own progress" on public.progress;
create policy "Users can read own progress"
on public.progress for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own progress" on public.progress;
create policy "Users can create own progress"
on public.progress for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own progress" on public.progress;
create policy "Users can update own progress"
on public.progress for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into public.subjects (title, slug, description, icon)
values
  ('Математика', 'matematyka', 'Алгебра, геометрія, аналіз даних і задачі для системного мислення.', 'emoji:🧮'),
  ('Фізика', 'fizyka', 'Механіка, електрика, хвилі, оптика та експерименти з поясненнями.', 'emoji:⚛️'),
  ('Хімія', 'khimiia', 'Речовини, реакції, рівняння та лабораторна логіка.', 'emoji:🧪'),
  ('Біологія', 'biolohiia', 'Від клітини до екосистеми: будова живого, генетика, еволюція й анатомія.', 'emoji:🧬'),
  ('Інформатика', 'informatyka', 'Основи роботи з комп''ютером, офісні інструменти, мережі, медіа та кібербезпека.', 'emoji:🖥️'),
  ('Комп''ютерні науки', 'kompiuterni-nauky', 'Теоретичні основи, системи, програмування, безпека, ШІ, медіа та прикладні напрями.', 'emoji:💻'),
  ('Мови програмування', 'movy-prohramuvannia', 'Практичні треки з популярних мов та інструментів програмування.', 'emoji:⌨️'),
  ('Інформаційні технології', 'informatsiini-tekhnolohii', 'Веб, мобільна розробка, DevOps, Data Science, кібербезпека та інші IT-напрямки.', 'emoji:⚙️'),
  ('Іноземні мови', 'inozemni-movy', 'Англійська, німецька, французька, іспанська та італійська від початку до впевненого рівня.', 'emoji:🗣️'),
  ('Історія', 'istoriia', 'Світова та українська історія від давніх цивілізацій до сучасності.', 'emoji:🏛️'),
  ('Географія', 'heohrafiia', 'Фізична та соціально-економічна географія, регіони світу й Україна.', 'emoji:🌎'),
  ('Інженерія', 'inzheneriia', 'Механічна, електрична, цивільна, хімічна та програмна інженерія.', 'emoji:🔧'),
  ('Економіка', 'ekonomika', 'Мікро- і макроекономіка, фінанси, облік, інвестиції та економетрія.', 'emoji:📈'),
  ('Філософія', 'filosofiia', 'Логіка, етика, епістемологія, онтологія та історія філософської думки.', 'emoji:🤔'),
  ('Антропологія', 'antropolohiia', 'Культурна, фізична, археологічна та лінгвістична антропологія.', 'emoji:🏺')
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon;

do $$
declare
  foreign_subject_id uuid;
  old_english_subject_id uuid;
  english_course_id uuid;
begin
  select id into foreign_subject_id from public.subjects where slug = 'inozemni-movy';
  select id into old_english_subject_id from public.subjects where slug = 'anhliiska-mova';

  if old_english_subject_id is not null and old_english_subject_id <> foreign_subject_id then
    update public.lessons
    set subject_id = foreign_subject_id
    where subject_id = old_english_subject_id;

    update public.courses
    set subject_id = foreign_subject_id
    where subject_id = old_english_subject_id;

    delete from public.subjects
    where id = old_english_subject_id;
  end if;

  insert into public.courses (subject_id, title, slug, description, order_index)
  values (
    foreign_subject_id,
    'Англійська мова',
    'anhliiska-mova',
    'Граматика, лексика, читання, письмо та розмовна практика.',
    1
  )
  on conflict (slug) do update set
    subject_id = excluded.subject_id,
    title = excluded.title,
    description = excluded.description,
    order_index = excluded.order_index
  returning id into english_course_id;

  update public.lessons
  set
    subject_id = foreign_subject_id,
    course_id = english_course_id
  where subject_id = foreign_subject_id
    and course_id is null;
end $$;

do $$
declare
  history_subject_id uuid;
  old_history_subject_id uuid;
begin
  select id into history_subject_id from public.subjects where slug = 'istoriia';
  select id into old_history_subject_id from public.subjects where slug = 'istoriia-ukrainy';

  if old_history_subject_id is not null and old_history_subject_id <> history_subject_id then
    update public.lessons
    set subject_id = history_subject_id
    where subject_id = old_history_subject_id;

    update public.courses
    set subject_id = history_subject_id
    where subject_id = old_history_subject_id;

    delete from public.subjects
    where id = old_history_subject_id;
  end if;
end $$;

with course_seed(subject_slug, title, slug, description, order_index) as (
  values
    ('matematyka', 'Вступ до алгебри', 'vstup-do-alhebry', null, 1),
    ('matematyka', 'Алгебра', 'alhebra', null, 2),
    ('matematyka', 'Геометрія та тригонометрія', 'heometriia-ta-tryhonometriia', null, 3),
    ('matematyka', 'Функції та вступ до матаналізу', 'funktsii-ta-vstup-do-matanalizu', null, 4),
    ('matematyka', 'Математичний аналіз', 'matematychnyi-analiz', null, 5),
    ('matematyka', 'Лінійна алгебра', 'liniina-alhebra', null, 6),
    ('matematyka', 'Теорія ймовірностей та статистика', 'teoriia-ymovirnostei-ta-statystyka', null, 7),
    ('matematyka', 'Дискретна математика та логіка', 'dyskretna-matematyka-ta-lohika', null, 8),
    ('matematyka', 'Диференціальні рівняння', 'dyferentsialni-rivniannia', null, 9),
    ('matematyka', 'Аналіз функцій дійсної змінної та поглиблені теми', 'analiz-funktsii-diisnoi-zminnoi-ta-pohlybleni-temy', null, 10),
    ('fizyka', 'Механіка', 'mekhanika', null, 1),
    ('fizyka', 'Термодинаміка', 'termodynamika', null, 2),
    ('fizyka', 'Електромагнетизм', 'elektromahnetyzm', null, 3),
    ('fizyka', 'Оптика та хвилі', 'optyka-ta-khvyli', null, 4),
    ('fizyka', 'Квантова фізика', 'kvantova-fizyka', null, 5),
    ('fizyka', 'Теорія відносності', 'teoriia-vidnosnosti', null, 6),
    ('khimiia', 'Загальна хімія', 'zahalna-khimiia', null, 1),
    ('khimiia', 'Неорганічна хімія', 'neorhanichna-khimiia', null, 2),
    ('khimiia', 'Органічна хімія', 'orhanichna-khimiia', null, 3),
    ('khimiia', 'Фізична хімія', 'fizychna-khimiia', null, 4),
    ('khimiia', 'Біохімія', 'biokhimiia', null, 5),
    ('biolohiia', 'Клітинна біологія', 'klitynna-biolohiia', null, 1),
    ('biolohiia', 'Генетика', 'henetyka', null, 2),
    ('biolohiia', 'Еволюція', 'evoliutsiia', null, 3),
    ('biolohiia', 'Екологія', 'ekolohiia', null, 4),
    ('biolohiia', 'Анатомія і фізіологія', 'anatomiia-i-fiziolohiia', null, 5),
    ('biolohiia', 'Мікробіологія', 'mikrobiolohiia', null, 6)
)
insert into public.courses (subject_id, title, slug, description, order_index)
select subjects.id, course_seed.title, course_seed.slug, course_seed.description, course_seed.order_index
from course_seed
join public.subjects on subjects.slug = course_seed.subject_slug
on conflict (slug) do update set
  subject_id = excluded.subject_id,
  title = excluded.title,
  description = excluded.description,
  order_index = excluded.order_index;

insert into storage.buckets (id, name, public)
values ('lesson-images', 'lesson-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Lesson images are public" on storage.objects;
create policy "Lesson images are public"
on storage.objects for select
using (bucket_id = 'lesson-images');

drop policy if exists "Authenticated users can upload lesson images" on storage.objects;
drop policy if exists "Admins can upload lesson images" on storage.objects;
create policy "Admins can upload lesson images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'lesson-images' and public.is_admin());

drop policy if exists "Users can update own lesson images" on storage.objects;
drop policy if exists "Admins can update lesson images" on storage.objects;
create policy "Admins can update lesson images"
on storage.objects for update
to authenticated
using (bucket_id = 'lesson-images' and public.is_admin())
with check (bucket_id = 'lesson-images' and public.is_admin());

drop policy if exists "Users can delete own lesson images" on storage.objects;
drop policy if exists "Admins can delete lesson images" on storage.objects;
create policy "Admins can delete lesson images"
on storage.objects for delete
to authenticated
using (bucket_id = 'lesson-images' and public.is_admin());
