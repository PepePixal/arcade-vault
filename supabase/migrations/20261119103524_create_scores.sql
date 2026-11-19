-- Single scores table referencing games. Data migration and removal of the
-- per-game table, the global_scores view and games.score_table come in a
-- later step of SPEC 13.
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  player_name text not null
    check (char_length(player_name) between 1 and 12)
    check (player_name ~ '^[A-Z0-9 -]+$')
    check (player_name = btrim(player_name)),
  score integer not null check (score >= 0),
  level integer not null check (level >= 1),
  -- Nullable until real authentication exists.
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index scores_game_score_idx
  on public.scores (game_id, score desc, created_at asc);
create index scores_created_at_idx
  on public.scores (created_at desc);
create index scores_player_name_idx
  on public.scores (player_name);

alter table public.scores enable row level security;

create policy "scores_select_public"
  on public.scores
  for select
  to anon, authenticated
  using (true);

create policy "scores_insert_public"
  on public.scores
  for insert
  to anon, authenticated
  with check (true);

-- Default privileges are revoked for public tables, so grant explicitly.
grant select, insert on public.scores to anon, authenticated;
