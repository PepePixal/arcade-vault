-- Copy existing Asteroides scores into scores, verify the copy, then remove
-- the per-game table, the global_scores view and games.score_table.
-- Runs after 20261119120000_create_scores.sql.

do $$
declare
  source_rows integer;
  target_rows integer;
begin
  select count(*) into source_rows from public.scores_asteroides;

  insert into public.scores (game_id, player_name, score, level, created_at)
  select 'asteroides', name, score, level, created_at
  from public.scores_asteroides;

  select count(*) into target_rows
  from public.scores
  where game_id = 'asteroides';

  if target_rows <> source_rows then
    raise exception 'scores copy mismatch: source %, target %',
      source_rows, target_rows;
  end if;
end $$;

drop view if exists public.global_scores;
drop table public.scores_asteroides;
alter table public.games drop column score_table;
