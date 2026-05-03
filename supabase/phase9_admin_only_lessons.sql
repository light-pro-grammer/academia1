-- Make lesson publishing admin-only.
-- Run this on existing Supabase projects after deploying the admin-only lesson flow.

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
