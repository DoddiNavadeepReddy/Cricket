-- Play XI: realtime room, auction, squad, and match schema.
-- Run this file in Supabase SQL Editor after enabling Anonymous Auth.

create extension if not exists pgcrypto;

create table if not exists public.players (
  id text primary key,
  name text not null,
  short_name text not null,
  role text not null check (role in ('BATTER', 'BOWLER', 'ALL-ROUNDER', 'WICKETKEEPER')),
  batting_style text not null,
  specialty text not null,
  base_price numeric(5, 1) not null check (base_price >= 0),
  country text not null,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(code) between 4 and 12),
  name text not null default 'Friends Premier League',
  status text not null default 'auction' check (status in ('lobby', 'auction', 'match', 'finished')),
  host_id uuid not null references auth.users(id) on delete cascade,
  max_members int not null default 6 check (max_members between 2 and 12),
  purse numeric(6, 1) not null default 100.0,
  current_player_id text references public.players(id),
  current_bid numeric(6, 1) not null default 0,
  current_bidder_id uuid references auth.users(id),
  auction_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_code_idx on public.rooms(code);

create table if not exists public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (length(display_name) between 2 and 24),
  team_name text not null check (length(team_name) between 2 and 30),
  color text not null default 'lime',
  purse numeric(6, 1) not null default 100.0,
  ready boolean not null default false,
  is_host boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, display_name)
);

create index if not exists room_members_room_idx on public.room_members(room_id);

create table if not exists public.auction_bids (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id text not null references public.players(id),
  bidder_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(6, 1) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists auction_bids_room_player_idx on public.auction_bids(room_id, player_id, created_at desc);

create table if not exists public.squad_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  member_id uuid not null references public.room_members(id) on delete cascade,
  player_id text not null references public.players(id),
  bought_at numeric(6, 1) not null check (bought_at > 0),
  selected_style text,
  created_at timestamptz not null default now(),
  unique (room_id, player_id)
);

create index if not exists squad_players_member_idx on public.squad_players(member_id);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  home_member_id uuid not null references public.room_members(id),
  away_member_id uuid not null references public.room_members(id),
  status text not null default 'live' check (status in ('scheduled', 'live', 'finished')),
  target int not null default 72,
  home_runs int not null default 0,
  home_wickets int not null default 0,
  home_balls int not null default 0,
  away_runs int not null default 0,
  away_wickets int not null default 0,
  away_balls int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  innings_member_id uuid not null references public.room_members(id),
  ball_number int not null,
  batting_style text not null,
  runs int not null default 0 check (runs between 0 and 6),
  is_wicket boolean not null default false,
  commentary text not null,
  created_at timestamptz not null default now()
);

create index if not exists match_events_match_idx on public.match_events(match_id, ball_number desc);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 300),
  created_at timestamptz not null default now()
);

-- Authenticated users can read room data. Writes are restricted to the current user,
-- with bid and match mutations going through the RPCs below.
alter table public.players enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.auction_bids enable row level security;
alter table public.squad_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
alter table public.room_messages enable row level security;

create policy "players are readable" on public.players for select to authenticated using (true);
create policy "rooms are readable" on public.rooms for select to authenticated using (true);
create policy "members are readable" on public.room_members for select to authenticated using (true);
create policy "bids are readable" on public.auction_bids for select to authenticated using (true);
create policy "squads are readable" on public.squad_players for select to authenticated using (true);
create policy "matches are readable" on public.matches for select to authenticated using (true);
create policy "match events are readable" on public.match_events for select to authenticated using (true);
create policy "messages are readable" on public.room_messages for select to authenticated using (true);
create policy "messages are writable by sender" on public.room_messages for insert to authenticated with check (auth.uid() = sender_id);

create or replace function public.join_room(
  p_room_code text,
  p_display_name text,
  p_team_name text,
  p_color text default 'lime'
)
returns public.room_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member public.room_members;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_room from public.rooms where upper(code) = upper(trim(p_room_code)) for update;
  if not found then
    raise exception 'ROOM_NOT_FOUND';
  end if;

  insert into public.room_members (room_id, user_id, display_name, team_name, color, is_host)
  values (v_room.id, v_user_id, trim(p_display_name), trim(p_team_name), p_color, v_room.host_id = v_user_id)
  on conflict (room_id, user_id) do update set
    display_name = excluded.display_name,
    team_name = excluded.team_name,
    color = excluded.color,
    last_seen_at = now()
  returning * into v_member;

  return v_member;
end;
$$;

create or replace function public.create_room(
  p_room_code text,
  p_room_name text default 'Friends Premier League'
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;

  insert into public.rooms (code, name, host_id, current_player_id, current_bid, auction_ends_at)
  values (upper(trim(p_room_code)), trim(p_room_name), auth.uid(), 'virat-kohli', 12.5, now() + interval '34 seconds')
  on conflict (code) do update set updated_at = now()
  returning * into v_room;

  return v_room;
end;
$$;

create or replace function public.place_bid(
  p_room_id uuid,
  p_player_id text,
  p_amount numeric
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member public.room_members;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.current_player_id is distinct from p_player_id then raise exception 'LOT_CHANGED'; end if;
  if p_amount <= v_room.current_bid then raise exception 'BID_TOO_LOW'; end if;

  select * into v_member from public.room_members where room_id = p_room_id and user_id = auth.uid();
  if not found then raise exception 'NOT_IN_ROOM'; end if;
  if p_amount > v_member.purse then raise exception 'INSUFFICIENT_PURSE'; end if;

  update public.rooms set current_bid = p_amount, current_bidder_id = auth.uid(), updated_at = now() where id = p_room_id returning * into v_room;
  insert into public.auction_bids (room_id, player_id, bidder_id, amount) values (p_room_id, p_player_id, auth.uid(), p_amount);
  return v_room;
end;
$$;

create or replace function public.record_match_ball(
  p_match_id uuid,
  p_innings_member_id uuid,
  p_batting_style text,
  p_runs int,
  p_is_wicket boolean,
  p_commentary text
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
  v_ball int;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then raise exception 'MATCH_NOT_FOUND'; end if;

  if v_match.home_member_id = p_innings_member_id then
    v_ball := v_match.home_balls + 1;
    update public.matches set home_runs = home_runs + case when p_is_wicket then 0 else p_runs end, home_wickets = home_wickets + case when p_is_wicket then 1 else 0 end, home_balls = home_balls + 1, updated_at = now() where id = p_match_id returning * into v_match;
  elsif v_match.away_member_id = p_innings_member_id then
    v_ball := v_match.away_balls + 1;
    update public.matches set away_runs = away_runs + case when p_is_wicket then 0 else p_runs end, away_wickets = away_wickets + case when p_is_wicket then 1 else 0 end, away_balls = away_balls + 1, updated_at = now() where id = p_match_id returning * into v_match;
  else
    raise exception 'NOT_A_MATCH_PLAYER';
  end if;

  insert into public.match_events (match_id, innings_member_id, ball_number, batting_style, runs, is_wicket, commentary)
  values (p_match_id, p_innings_member_id, v_ball, p_batting_style, p_runs, p_is_wicket, p_commentary);
  return v_match;
end;
$$;

create or replace function public.buy_player(
  p_room_id uuid,
  p_player_id text,
  p_price numeric,
  p_selected_style text
)
returns public.squad_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_member public.room_members;
  v_squad public.squad_players;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  select * into v_member from public.room_members where room_id = p_room_id and user_id = auth.uid() for update;
  if not found then raise exception 'NOT_IN_ROOM'; end if;
  if p_price > v_member.purse then raise exception 'INSUFFICIENT_PURSE'; end if;

  insert into public.squad_players (room_id, member_id, player_id, bought_at, selected_style)
  values (p_room_id, v_member.id, p_player_id, p_price, p_selected_style)
  on conflict (room_id, player_id) do update set selected_style = excluded.selected_style
  returning * into v_squad;

  update public.room_members set purse = purse - p_price where id = v_member.id;
  update public.rooms set current_player_id = null, current_bid = 0, current_bidder_id = null, auction_ends_at = null, updated_at = now() where id = p_room_id;
  return v_squad;
end;
$$;

create or replace function public.set_player_style(
  p_squad_id uuid,
  p_selected_style text
)
returns public.squad_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_squad public.squad_players;
begin
  update public.squad_players sp
  set selected_style = p_selected_style
  where sp.id = p_squad_id
    and exists (
      select 1 from public.room_members rm
      where rm.id = sp.member_id and rm.user_id = auth.uid()
    )
  returning * into v_squad;
  if not found then raise exception 'SQUAD_PLAYER_NOT_FOUND'; end if;
  return v_squad;
end;
$$;

create or replace function public.start_match(p_room_id uuid)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home public.room_members;
  v_away public.room_members;
  v_match public.matches;
begin
  select * into v_home from public.room_members where room_id = p_room_id and user_id = auth.uid();
  select * into v_away from public.room_members where room_id = p_room_id and user_id <> auth.uid() order by created_at limit 1;
  if not found then raise exception 'WAITING_FOR_OPPONENT'; end if;

  insert into public.matches (room_id, home_member_id, away_member_id)
  values (p_room_id, v_home.id, v_away.id)
  returning * into v_match;

  update public.rooms set status = 'match', updated_at = now() where id = p_room_id;
  return v_match;
end;
$$;

grant execute on function public.join_room(text, text, text, text) to authenticated;
grant execute on function public.create_room(text, text) to authenticated;
grant execute on function public.place_bid(uuid, text, numeric) to authenticated;
grant execute on function public.record_match_ball(uuid, uuid, text, int, boolean, text) to authenticated;
grant execute on function public.buy_player(uuid, text, numeric, text) to authenticated;
grant execute on function public.set_player_style(uuid, text) to authenticated;
grant execute on function public.start_match(uuid) to authenticated;

-- Realtime publication for live room updates.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.auction_bids;
alter publication supabase_realtime add table public.squad_players;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_events;
alter publication supabase_realtime add table public.room_messages;

insert into public.players (id, name, short_name, role, batting_style, specialty, base_price, country, image_url)
values
  ('virat-kohli', 'Virat Kohli', 'V. Kohli', 'BATTER', 'The cover drive', 'Chase architect', 11.0, 'IND', 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&w=900&q=85'),
  ('rohit-sharma', 'Rohit Sharma', 'R. Sharma', 'BATTER', 'The pull shot', 'Powerplay captain', 10.0, 'IND', 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=85'),
  ('jasprit-bumrah', 'Jasprit Bumrah', 'J. Bumrah', 'BOWLER', 'The perfect yorker', 'Death overs', 9.0, 'IND', 'https://images.unsplash.com/photo-1508344928928-716c7b5d2f64?auto=format&fit=crop&w=600&q=85'),
  ('ms-dhoni', 'M. S. Dhoni', 'M. S. Dhoni', 'WICKETKEEPER', 'The helicopter', 'Finisher', 8.0, 'IND', 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=600&q=85'),
  ('smriti-mandhana', 'Smriti Mandhana', 'S. Mandhana', 'BATTER', 'The lofted drive', 'Elegant opener', 7.0, 'IND', 'https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=600&q=85'),
  ('glenn-maxwell', 'Glenn Maxwell', 'G. Maxwell', 'ALL-ROUNDER', 'The switch hit', 'Game breaker', 7.0, 'AUS', 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=600&q=85'),
  ('rashid-khan', 'Rashid Khan', 'R. Khan', 'BOWLER', 'The googly', 'Middle overs', 6.0, 'AFG', 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=600&q=85')
on conflict (id) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  role = excluded.role,
  batting_style = excluded.batting_style,
  specialty = excluded.specialty,
  base_price = excluded.base_price,
  country = excluded.country,
  image_url = excluded.image_url;
