create table public.scores_asteroides (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(name) between 1 and 12)
    check (name ~ '^[A-Z0-9 -]+$')
    check (name = btrim(name)),
  score integer not null check (score >= 0),
  level integer not null check (level >= 1),
  created_at timestamptz not null default now()
);

create index scores_asteroides_score_idx
  on public.scores_asteroides (score desc, created_at asc);
create index scores_asteroides_created_at_idx
  on public.scores_asteroides (created_at desc);
create index scores_asteroides_name_idx
  on public.scores_asteroides (name);

alter table public.scores_asteroides enable row level security;

create policy "scores_asteroides_select_public"
  on public.scores_asteroides
  for select
  to anon, authenticated
  using (true);

create policy "scores_asteroides_insert_public"
  on public.scores_asteroides
  for insert
  to anon, authenticated
  with check (true);
