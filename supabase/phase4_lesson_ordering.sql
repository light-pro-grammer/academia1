alter table public.lessons
add column if not exists order_index integer not null default 0;

update public.lessons l
set order_index = sub.row_num
from (
  select
    id,
    row_number() over (
      partition by course_id
      order by created_at
    ) - 1 as row_num
  from public.lessons
) sub
where l.id = sub.id;

create index if not exists lessons_course_order_idx
on public.lessons(course_id, order_index);

drop policy if exists "Admins can delete lessons" on public.lessons;
create policy "Admins can delete lessons"
on public.lessons for delete
to authenticated
using (public.is_admin());
