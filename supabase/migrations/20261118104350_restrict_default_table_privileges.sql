-- Existing objects: keep only what each one needs.
revoke all on public.games from anon, authenticated;
grant select on public.games to anon, authenticated;

revoke all on public.scores_asteroides from anon, authenticated;
grant select, insert on public.scores_asteroides to anon, authenticated;

revoke all on public.global_scores from anon, authenticated;
grant select on public.global_scores to anon, authenticated;

-- Future objects created by postgres in public: no automatic access for
-- anon/authenticated. Each new table or view must be granted explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
