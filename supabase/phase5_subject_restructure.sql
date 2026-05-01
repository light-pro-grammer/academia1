begin;

insert into public.subjects (title, slug, description, icon)
values
  ('Математика', 'matematyka', 'Алгебра, геометрія, аналіз даних і задачі для системного мислення.', 'calculator'),
  ('Фізика', 'fizyka', 'Механіка, електрика, хвилі, оптика та експерименти з поясненнями.', 'atom'),
  ('Хімія', 'khimiia', 'Речовини, реакції, рівняння та лабораторна логіка.', 'flask'),
  ('Біологія', 'biolohiia', 'Клітини, спадковість, еволюція, екосистеми та будова живих організмів.', 'dna'),
  ('Географія', 'heohrafiia', 'Карти, країни, природні системи та взаємодія людини з простором.', 'globe')
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
  select id into foreign_subject_id
  from public.subjects
  where slug = 'inozemni-movy';

  select id into old_english_subject_id
  from public.subjects
  where slug = 'anhliiska-mova';

  if foreign_subject_id is null and old_english_subject_id is not null then
    update public.subjects
    set
      title = 'Іноземні мови',
      slug = 'inozemni-movy',
      description = 'Англійська та інші іноземні мови: граматика, лексика, читання, письмо та розмовна практика.',
      icon = 'languages'
    where id = old_english_subject_id
    returning id into foreign_subject_id;
  elsif foreign_subject_id is null then
    insert into public.subjects (title, slug, description, icon)
    values (
      'Іноземні мови',
      'inozemni-movy',
      'Англійська та інші іноземні мови: граматика, лексика, читання, письмо та розмовна практика.',
      'languages'
    )
    returning id into foreign_subject_id;
  elsif old_english_subject_id is not null and old_english_subject_id <> foreign_subject_id then
    update public.lessons
    set subject_id = foreign_subject_id
    where subject_id = old_english_subject_id;

    update public.courses
    set subject_id = foreign_subject_id
    where subject_id = old_english_subject_id;

    if to_regclass('public.exams') is not null then
      update public.exams
      set subject_id = foreign_subject_id
      where subject_id = old_english_subject_id;
    end if;

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
  select id into history_subject_id
  from public.subjects
  where slug = 'istoriia';

  select id into old_history_subject_id
  from public.subjects
  where slug = 'istoriia-ukrainy';

  if history_subject_id is null and old_history_subject_id is not null then
    update public.subjects
    set
      title = 'Історія',
      slug = 'istoriia',
      description = 'Події, джерела, постаті та історичний контекст України і світу.',
      icon = 'landmark'
    where id = old_history_subject_id
    returning id into history_subject_id;
  elsif history_subject_id is null then
    insert into public.subjects (title, slug, description, icon)
    values (
      'Історія',
      'istoriia',
      'Події, джерела, постаті та історичний контекст України і світу.',
      'landmark'
    )
    returning id into history_subject_id;
  elsif old_history_subject_id is not null and old_history_subject_id <> history_subject_id then
    update public.lessons
    set subject_id = history_subject_id
    where subject_id = old_history_subject_id;

    update public.courses
    set subject_id = history_subject_id
    where subject_id = old_history_subject_id;

    if to_regclass('public.exams') is not null then
      update public.exams
      set subject_id = history_subject_id
      where subject_id = old_history_subject_id;
    end if;

    delete from public.subjects
    where id = old_history_subject_id;
  end if;

  update public.subjects
  set
    title = 'Історія',
    description = 'Події, джерела, постаті та історичний контекст України і світу.',
    icon = 'landmark'
  where id = history_subject_id;
end $$;

commit;
