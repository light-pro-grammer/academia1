-- Remove the old exam domain from existing Supabase projects.
-- The app now uses lessons, courses, progress, and markdown exercise/solution callouts.

drop table if exists public.exam_attempts cascade;
drop table if exists public.exam_questions cascade;
drop table if exists public.exams cascade;
