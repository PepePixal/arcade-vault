create view public.global_scores with (security_invoker = true) as
  select 'asteroides'::text as game_id, id, name, score, level, created_at
  from public.scores_asteroides;
