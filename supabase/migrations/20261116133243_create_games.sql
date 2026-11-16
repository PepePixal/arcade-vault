create table public.games (
  id text primary key,
  title text not null,
  short_description text not null,
  long_description text not null,
  category text not null check (category in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'green', 'yellow')),
  score_table text not null unique,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games_select_public"
  on public.games
  for select
  to anon, authenticated
  using (true);

insert into public.games (id, title, short_description, long_description, category, cover, color, score_table)
values (
  'asteroides',
  'ASTEROIDES',
  'Esquiva y destruye un cinturón de asteroides vectoriales.',
  'Rota, propulsa y dispara para partir cada asteroide en fragmentos más pequeños y veloces. Limpia el campo para avanzar de nivel y atrapa los power-ups de Triple Shot y escudo. Tienes 3 vidas.',
  'SHOOTER',
  'cover-asteroides',
  'cyan',
  'scores_asteroides'
);
