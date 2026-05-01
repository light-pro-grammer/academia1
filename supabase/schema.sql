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

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  content text not null,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (user_id, lesson_id)
);

create index if not exists subjects_slug_idx on public.subjects(slug);
create index if not exists lessons_slug_idx on public.lessons(slug);
create index if not exists lessons_subject_status_idx on public.lessons(subject_id, status);
create index if not exists lessons_author_idx on public.lessons(author_id);
create index if not exists lessons_course_order_idx on public.lessons(course_id, order_index);
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

drop policy if exists "Approved lessons are public, owners and admins see own scope" on public.lessons;
create policy "Approved lessons are public, owners and admins see own scope"
on public.lessons for select
using (
  status = 'approved'
  or author_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Authenticated users can create pending lessons" on public.lessons;
create policy "Authenticated users can create pending lessons"
on public.lessons for insert
to authenticated
with check (
  auth.uid() = author_id
  and status = 'pending'
);

drop policy if exists "Admins can moderate lessons" on public.lessons;
create policy "Admins can moderate lessons"
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
  ('Математика', 'matematyka', 'Алгебра, геометрія, аналіз даних і задачі для системного мислення.', 'calculator'),
  ('Фізика', 'fizyka', 'Механіка, електрика, хвилі, оптика та експерименти з поясненнями.', 'atom'),
  ('Англійська мова', 'anhliiska-mova', 'Граматика, лексика, читання, письмо та розмовна практика.', 'languages'),
  ('Історія України', 'istoriia-ukrainy', 'Події, джерела, постаті та контекст української історії.', 'landmark'),
  ('Хімія', 'khimiia', 'Речовини, реакції, рівняння та лабораторна логіка.', 'flask'),
  ('Географія', 'heohrafiia', 'Карти, країни, природні системи та взаємодія людини з простором.', 'globe')
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon;

insert into storage.buckets (id, name, public)
values ('lesson-images', 'lesson-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Lesson images are public" on storage.objects;
create policy "Lesson images are public"
on storage.objects for select
using (bucket_id = 'lesson-images');

drop policy if exists "Authenticated users can upload lesson images" on storage.objects;
create policy "Authenticated users can upload lesson images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'lesson-images');

drop policy if exists "Users can update own lesson images" on storage.objects;
create policy "Users can update own lesson images"
on storage.objects for update
to authenticated
using (bucket_id = 'lesson-images' and owner = auth.uid())
with check (bucket_id = 'lesson-images' and owner = auth.uid());

drop policy if exists "Users can delete own lesson images" on storage.objects;
create policy "Users can delete own lesson images"
on storage.objects for delete
to authenticated
using (bucket_id = 'lesson-images' and owner = auth.uid());
