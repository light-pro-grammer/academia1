# Академія Україна

Phase 1 foundation for a Ukrainian educational platform built with Next.js 14,
TypeScript, Tailwind CSS, Supabase Auth/Database/Storage, TipTap Markdown,
KaTeX, and Shiki.

## Environment

Create `.env.local` from `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Supabase

Run the SQL in `supabase/schema.sql` in the Supabase SQL editor for Phase 1. It creates:

- `profiles`, `subjects`, `lessons`, `progress`
- auth profile trigger
- lesson moderation status constraints
- row-level security policies
- starter Ukrainian subjects
- public `lesson-images` storage bucket and policies

For Phase 2, run `supabase/phase2.sql` after Phase 1. It adds:

- `exercises`, `exercise_results`
- `exams`, `exam_questions`, `exam_attempts`
- indexes and RLS policies for exercises, exams, and attempts

To make a user an admin after registration:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID';
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Checks

```bash
npm run lint
npm run build
```
