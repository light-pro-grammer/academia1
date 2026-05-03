begin;

insert into public.subjects (title, slug, description, icon)
values
  (
    'Біологія',
    'biolohiia',
    'Від клітини до екосистеми: будова живого, генетика, еволюція й анатомія.',
    'emoji:🧬'
  ),
  (
    'Інформатика',
    'informatyka',
    'Основи роботи з комп''ютером, офісні інструменти, мережі, медіа та кібербезпека.',
    'emoji:🖥️'
  ),
  (
    'Комп''ютерні науки',
    'kompiuterni-nauky',
    'Теоретичні основи, системи, програмування, безпека, ШІ, медіа та прикладні напрями.',
    'emoji:💻'
  ),
  (
    'Мови програмування',
    'movy-prohramuvannia',
    'Практичні треки з популярних мов та інструментів програмування.',
    'emoji:⌨️'
  ),
  (
    'Інформаційні технології',
    'informatsiini-tekhnolohii',
    'Веб, мобільна розробка, DevOps, Data Science, кібербезпека та інші IT-напрямки.',
    'emoji:⚙️'
  ),
  (
    'Інженерія',
    'inzheneriia',
    'Механічна, електрична, цивільна, хімічна та програмна інженерія.',
    'emoji:🔧'
  ),
  (
    'Економіка',
    'ekonomika',
    'Мікро- і макроекономіка, фінанси, облік, інвестиції та економетрія.',
    'emoji:📈'
  ),
  (
    'Філософія',
    'filosofiia',
    'Логіка, етика, епістемологія, онтологія та історія філософської думки.',
    'emoji:🤔'
  ),
  (
    'Антропологія',
    'antropolohiia',
    'Культурна, фізична, археологічна та лінгвістична антропологія.',
    'emoji:🏺'
  )
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
      description = 'Англійська, німецька, французька, іспанська та італійська від початку до впевненого рівня.',
      icon = 'languages'
    where id = old_english_subject_id
    returning id into foreign_subject_id;
  elsif foreign_subject_id is null then
    insert into public.subjects (title, slug, description, icon)
    values (
      'Іноземні мови',
      'inozemni-movy',
      'Англійська, німецька, французька, іспанська та італійська від початку до впевненого рівня.',
      'languages'
    )
    returning id into foreign_subject_id;
  elsif old_english_subject_id is not null and old_english_subject_id <> foreign_subject_id then
    update public.lessons
    set subject_id = foreign_subject_id
    where subject_id = old_english_subject_id;

    if to_regclass('public.courses') is not null then
      update public.courses
      set subject_id = foreign_subject_id
      where subject_id = old_english_subject_id;
    end if;

    if to_regclass('public.exams') is not null then
      update public.exams
      set subject_id = foreign_subject_id
      where subject_id = old_english_subject_id;
    end if;

    delete from public.subjects
    where id = old_english_subject_id;
  end if;

  if to_regclass('public.courses') is not null then
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
  end if;
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
      description = 'Світова та українська історія від давніх цивілізацій до сучасності.',
      icon = 'landmark'
    where id = old_history_subject_id
    returning id into history_subject_id;
  elsif history_subject_id is null then
    insert into public.subjects (title, slug, description, icon)
    values (
      'Історія',
      'istoriia',
      'Світова та українська історія від давніх цивілізацій до сучасності.',
      'landmark'
    )
    returning id into history_subject_id;
  elsif old_history_subject_id is not null and old_history_subject_id <> history_subject_id then
    update public.lessons
    set subject_id = history_subject_id
    where subject_id = old_history_subject_id;

    if to_regclass('public.courses') is not null then
      update public.courses
      set subject_id = history_subject_id
      where subject_id = old_history_subject_id;
    end if;

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
    description = 'Світова та українська історія від давніх цивілізацій до сучасності.',
    icon = 'landmark'
  where id = history_subject_id;
end $$;

update public.subjects
set
  title = 'Географія',
  description = 'Фізична та соціально-економічна географія, регіони світу й Україна.',
  icon = 'emoji:🌎'
where slug = 'heohrafiia';

commit;
