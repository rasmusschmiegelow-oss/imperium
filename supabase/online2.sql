-- Imperium online 2.0: chat, spillerkoder (fortsæt på en anden enhed) og computerovertagelse.
-- Køres efter schema.sql. Kan køres igen uden at gå i stykker.

alter table public.players add column if not exists is_ai boolean not null default false;

-- Hemmelige spillerkoder: kun ejeren kan se sin egen
create table if not exists public.player_secrets (
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null,
  code text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (game_id, seat)
);
alter table public.player_secrets enable row level security;
drop policy if exists secrets_select on public.player_secrets;
create policy secrets_select on public.player_secrets for select to authenticated using (user_id = auth.uid());

-- Chat
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index if not exists messages_game_idx on public.messages (game_id, id);
alter table public.messages enable row level security;
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (public.is_player(game_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.is_player(game_id)
    and name = (select p.name from public.players p where p.game_id = messages.game_id and p.user_id = auth.uid()));

-- Ny hemmelig kode til en plads
create or replace function public.make_secret(p_game uuid, p_seat int, p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text := '';
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  for i in 1..8 loop
    v := v || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    if i = 4 then v := v || '-'; end if;
  end loop;
  insert into public.player_secrets (game_id, seat, code, user_id) values (p_game, p_seat, v, p_user)
    on conflict (game_id, seat) do update set code = excluded.code, user_id = excluded.user_id;
  return v;
end $$;
revoke all on function public.make_secret(uuid, int, uuid) from public, anon, authenticated;

-- create_game og join_game laver nu også en spillerkode
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
  perform public.make_secret(v_id, 0, auth.uid());
  return query select v_id, v_code;
end $$;

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
  if g.status <> 'lobby' then raise exception 'Spillet er allerede gået i gang. Har du en spillerkode, så brug Fortsæt på denne enhed.'; end if;
  if (select count(*) from public.players where game_id = g.id) >= 4 then raise exception 'Spillet er fuldt (højst 4 spillere)'; end if;
  if exists (select 1 from public.players where game_id = g.id and civ = p_civ) then raise exception 'Det folk er allerede valgt af en anden spiller'; end if;
  select coalesce(max(seat), -1) + 1 into v_seat from public.players where game_id = g.id;
  insert into public.players (game_id, user_id, name, civ, seat) values (g.id, auth.uid(), left(p_name, 24), p_civ, v_seat);
  perform public.make_secret(g.id, v_seat, auth.uid());
  return g.id;
end $$;

-- Fortsæt på en anden enhed med spilkode og spillerkode
create or replace function public.recover_seat(p_code text, p_secret text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  s public.player_secrets;
begin
  if auth.uid() is null then raise exception 'Du er ikke logget ind'; end if;
  select * into g from public.games where code = upper(trim(p_code));
  if not found then raise exception 'Der findes ikke et spil med den kode'; end if;
  select * into s from public.player_secrets where game_id = g.id and code = upper(trim(p_secret));
  if not found then raise exception 'Spillerkoden passer ikke til det spil'; end if;
  if s.user_id = auth.uid() then return g.id; end if;
  if exists (select 1 from public.players where game_id = g.id and user_id = auth.uid()) then
    raise exception 'Denne enhed har allerede en anden plads i spillet';
  end if;
  update public.players set user_id = auth.uid() where game_id = g.id and seat = s.seat;
  update public.player_secrets set user_id = auth.uid() where game_id = g.id and seat = s.seat;
  if g.host = s.user_id then update public.games set host = auth.uid() where id = g.id; end if;
  return g.id;
end $$;

-- Værten kan lade computeren styre en plads (eller give den tilbage)
create or replace function public.set_ai(p_game uuid, p_seat int, p_ai boolean)
returns void language plpgsql security definer set search_path = public as $$
declare g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found then raise exception 'Spillet findes ikke'; end if;
  if g.host <> auth.uid() then raise exception 'Kun værten kan gøre det'; end if;
  update public.players set is_ai = p_ai where game_id = p_game and seat = p_seat;
end $$;

-- submit_turn: værten må spille turen for en plads, som computeren styrer
create or replace function public.submit_turn(p_game uuid, p_version int, p_state text, p_turn int, p_next int, p_status text)
returns int language plpgsql security definer set search_path = public as $$
declare
  g public.games;
  v_seat int;
  v_ai boolean;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'Spillet findes ikke'; end if;
  select seat into v_seat from public.players where game_id = p_game and user_id = auth.uid();
  if v_seat is null then raise exception 'Du er ikke med i dette spil'; end if;
  if g.version <> p_version then raise exception 'Spillet er blevet ændret i mellemtiden. Hent det igen.'; end if;
  if g.status = 'over' then raise exception 'Spillet er slut'; end if;
  if g.status = 'lobby' and g.host <> auth.uid() then raise exception 'Kun værten kan starte spillet'; end if;
  if g.status = 'playing' and g.current_player <> v_seat then
    select is_ai into v_ai from public.players where game_id = p_game and seat = g.current_player;
    if not (g.host = auth.uid() and coalesce(v_ai, false)) then raise exception 'Det er ikke din tur'; end if;
  end if;
  if p_status not in ('playing', 'over') then raise exception 'Ugyldig status'; end if;
  update public.games set state = p_state, turn = p_turn, current_player = p_next, status = p_status,
    version = g.version + 1, updated_at = now() where id = p_game;
  return g.version + 1;
end $$;

-- Spillerkoder til spil fra før denne opdatering
do $$
declare r record;
begin
  for r in select p.game_id, p.seat, p.user_id from public.players p
    left join public.player_secrets s on s.game_id = p.game_id and s.seat = p.seat where s.game_id is null loop
    perform public.make_secret(r.game_id, r.seat, r.user_id);
  end loop;
end $$;

revoke all on function public.recover_seat(text, text) from public, anon;
revoke all on function public.set_ai(uuid, int, boolean) from public, anon;
grant execute on function public.recover_seat(text, text) to authenticated;
grant execute on function public.set_ai(uuid, int, boolean) to authenticated;
grant execute on function public.create_game(text, text, jsonb) to authenticated;
grant execute on function public.join_game(text, text, text) to authenticated;
grant execute on function public.submit_turn(uuid, int, text, int, int, text) to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
end $$;

revoke all on function public.is_player(uuid) from public, anon;
grant execute on function public.is_player(uuid) to authenticated;
