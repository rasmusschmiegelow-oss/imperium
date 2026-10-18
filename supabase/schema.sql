-- Imperium online: tabeller, adgangsregler og funktioner.
-- Kør hele filen i Supabase → SQL Editor. Den kan køres igen uden at gå i stykker.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host uuid not null references auth.users (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'over')),
  settings jsonb not null default '{}'::jsonb,
  state text,
  turn int not null default 0,
  current_player int,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 24),
  civ text not null,
  seat int not null,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id),
  unique (game_id, civ),
  unique (game_id, seat)
);

alter table public.games enable row level security;
alter table public.players enable row level security;

-- Er den indloggede bruger med i spillet?
create or replace function public.is_player(g uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.players where game_id = g and user_id = auth.uid());
$$;

drop policy if exists games_select on public.games;
create policy games_select on public.games for select to authenticated
  using (host = auth.uid() or public.is_player(id));

drop policy if exists games_insert on public.games;
create policy games_insert on public.games for insert to authenticated
  with check (host = auth.uid() and status = 'lobby' and state is null);

drop policy if exists players_select on public.players;
create policy players_select on public.players for select to authenticated
  using (public.is_player(game_id));

-- Ingen direkte ændringer: alt andet går gennem funktionerne herunder.

-- Opret et spil og sæt værten på plads 0
create or replace function public.create_game(p_name text, p_civ text, p_settings jsonb)
returns table (id uuid, code text) language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_id uuid;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'Du er ikke logget ind'; end if;
  loop
    v_code := '';
    for i in 1..5 loop v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.games g where g.code = v_code);
  end loop;
  insert into public.games (code, host, settings) values (v_code, auth.uid(), coalesce(p_settings, '{}'::jsonb)) returning games.id into v_id;
  insert into public.players (game_id, user_id, name, civ, seat) values (v_id, auth.uid(), left(p_name, 24), p_civ, 0);
  return query select v_id, v_code;
end $$;

-- Deltag i et spil med en kode (eller skift navn/folk i lobbyen)
create or replace function public.join_game(p_code text, p_name text, p_civ text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  v_seat int;
begin
  if auth.uid() is null then raise exception 'Du er ikke logget ind'; end if;
  select * into g from public.games where code = upper(trim(p_code));
  if not found then raise exception 'Der findes ikke et spil med den kode'; end if;
  if exists (select 1 from public.players where game_id = g.id and user_id = auth.uid()) then
    if g.status = 'lobby' then
      if exists (select 1 from public.players where game_id = g.id and civ = p_civ and user_id <> auth.uid()) then
        raise exception 'Det folk er allerede valgt af en anden spiller';
      end if;
      update public.players set name = left(p_name, 24), civ = p_civ where game_id = g.id and user_id = auth.uid();
    end if;
    return g.id;
  end if;
  if g.status <> 'lobby' then raise exception 'Spillet er allerede gået i gang'; end if;
  if (select count(*) from public.players where game_id = g.id) >= 4 then raise exception 'Spillet er fuldt (højst 4 spillere)'; end if;
  if exists (select 1 from public.players where game_id = g.id and civ = p_civ) then raise exception 'Det folk er allerede valgt af en anden spiller'; end if;
  select coalesce(max(seat), -1) + 1 into v_seat from public.players where game_id = g.id;
  insert into public.players (game_id, user_id, name, civ, seat) values (g.id, auth.uid(), left(p_name, 24), p_civ, v_seat);
  return g.id;
end $$;

-- Forlad et spil i lobbyen
create or replace function public.leave_game(p_game uuid)
returns void language plpgsql security definer set search_path = public as $$
declare g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found then return; end if;
  if g.host = auth.uid() and g.status = 'lobby' then delete from public.games where id = p_game; return; end if;
  if g.status = 'lobby' then delete from public.players where game_id = p_game and user_id = auth.uid(); end if;
end $$;

-- Gem en tur. Kun spilleren, hvis tur det er, må gemme, og kun oven på den nyeste version.
create or replace function public.submit_turn(p_game uuid, p_version int, p_state text, p_turn int, p_next int, p_status text)
returns int language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  v_seat int;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'Spillet findes ikke'; end if;
  select seat into v_seat from public.players where game_id = p_game and user_id = auth.uid();
  if v_seat is null then raise exception 'Du er ikke med i dette spil'; end if;
  if g.version <> p_version then raise exception 'Spillet er blevet ændret i mellemtiden. Hent det igen.'; end if;
  if g.status = 'over' then raise exception 'Spillet er slut'; end if;
  if g.status = 'lobby' and g.host <> auth.uid() then raise exception 'Kun værten kan starte spillet'; end if;
  if g.status = 'playing' and g.current_player <> v_seat then raise exception 'Det er ikke din tur'; end if;
  if p_status not in ('playing', 'over') then raise exception 'Ugyldig status'; end if;
  update public.games set state = p_state, turn = p_turn, current_player = p_next, status = p_status,
    version = g.version + 1, updated_at = now() where id = p_game;
  return g.version + 1;
end $$;

revoke all on function public.create_game(text, text, jsonb) from public, anon;
revoke all on function public.join_game(text, text, text) from public, anon;
revoke all on function public.leave_game(uuid) from public, anon;
revoke all on function public.submit_turn(uuid, int, text, int, int, text) from public, anon;
grant execute on function public.create_game(text, text, jsonb) to authenticated;
grant execute on function public.join_game(text, text, text) to authenticated;
grant execute on function public.leave_game(uuid) to authenticated;
grant execute on function public.submit_turn(uuid, int, text, int, int, text) to authenticated;
grant execute on function public.is_player(uuid) to authenticated;

-- Besked i realtid, når et spil eller en spillerliste ændrer sig
do $$
begin
  begin alter publication supabase_realtime add table public.games; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.players; exception when duplicate_object then null; end;
end $$;
