# Supabase SQL

## Fresh project

Run `schema.sql` in the Supabase SQL editor. It is the current consolidated
schema snapshot for the app:

- tables and indexes
- auth/profile trigger
- RLS policies
- storage bucket policies for lesson images
- current subject seed data
- current course seed data

## Existing project

The `phase*.sql` files are historical incremental migrations from earlier
development phases. Keep them for reference, but do not run them after
`schema.sql` on a fresh project.

For an existing database that already used the phase files, you can run the
current `schema.sql` safely as an idempotent reconciliation pass. It uses
`create table if not exists`, `create index if not exists`, `drop policy if
exists`, and `on conflict` seeds.

## Source of truth

Going forward, update `schema.sql` whenever the active application schema
changes. If a production database needs a surgical change, add a new `phase*.sql`
migration and then fold that change back into `schema.sql`.
