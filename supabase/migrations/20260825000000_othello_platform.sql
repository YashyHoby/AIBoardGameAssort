create extension if not exists pgcrypto;

create type public.disc_color as enum ('black', 'white');
create type public.room_status as enum ('waiting', 'playing', 'finished');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  game_id text not null check (game_id = 'othello'),
  status public.room_status not null default 'waiting',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  color public.disc_color,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, color)
);

create table public.game_sessions (
  id uuid primary key,
  room_id uuid not null unique references public.rooms (id) on delete cascade,
  game_id text not null check (game_id = 'othello'),
  state jsonb not null,
  state_version integer not null default 0 check (state_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_actions (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  action_id uuid not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  expected_state_version integer not null check (expected_state_version >= 0),
  action_type text not null check (action_type in ('place_disc', 'pass', 'resign')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (session_id, action_id)
);

create index room_members_user_id_idx on public.room_members (user_id);
create index game_actions_session_id_created_at_idx on public.game_actions (session_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

create trigger game_sessions_set_updated_at
before update on public.game_sessions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      'Player ' || substring(new.id::text from 1 for 8)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_room_member(target_room_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.room_members
    where room_id = target_room_id
      and user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_actions enable row level security;

create policy "authenticated users can read profiles"
on public.profiles for select to authenticated
using (true);

create policy "users can update only their profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "members can read their rooms"
on public.rooms for select to authenticated
using (public.is_room_member(id));

create policy "members can read room membership"
on public.room_members for select to authenticated
using (public.is_room_member(room_id));

-- game_sessionsとgame_actionsにはクライアント向けのpolicyを作らない。
-- 読み書きはJWTを検証するEdge Functionだけを経由させる。

create or replace function public.commit_othello_action(
  p_session_id uuid,
  p_expected_state_version integer,
  p_action_id uuid,
  p_actor_id uuid,
  p_action_type text,
  p_payload jsonb,
  p_next_state jsonb
)
returns void
language plpgsql
security definer set search_path = public, realtime
as $$
declare
  current_session public.game_sessions%rowtype;
begin
  select *
  into current_session
  from public.game_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.game_actions
    where session_id = p_session_id
      and action_id = p_action_id
  ) then
    raise exception 'DUPLICATE_ACTION' using errcode = 'P0001';
  end if;

  if current_session.state_version <> p_expected_state_version then
    raise exception 'INVALID_VERSION' using errcode = 'P0001';
  end if;

  if coalesce((p_next_state ->> 'stateVersion')::integer, -1)
       <> p_expected_state_version + 1 then
    raise exception 'INVALID_NEXT_STATE' using errcode = 'P0001';
  end if;

  insert into public.game_actions (
    session_id,
    action_id,
    actor_id,
    expected_state_version,
    action_type,
    payload
  )
  values (
    p_session_id,
    p_action_id,
    p_actor_id,
    p_expected_state_version,
    p_action_type,
    p_payload
  );

  update public.game_sessions
  set
    state = p_next_state,
    state_version = p_expected_state_version + 1
  where id = p_session_id;

  if p_next_state ->> 'phase' = 'finished' then
    update public.rooms
    set status = 'finished'
    where id = current_session.room_id;
  end if;

  perform realtime.send(
    jsonb_build_object(
      'sessionId', p_session_id,
      'stateVersion', p_expected_state_version + 1
    ),
    'state_updated',
    'room:' || current_session.room_id::text,
    true
  );
end;
$$;

create or replace function public.notify_room_state(
  p_room_id uuid,
  p_session_id uuid,
  p_state_version integer
)
returns void
language plpgsql
security definer set search_path = public, realtime
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'sessionId', p_session_id,
      'stateVersion', p_state_version
    ),
    'state_updated',
    'room:' || p_room_id::text,
    true
  );
end;
$$;

create or replace function public.commit_othello_room_join(
  p_room_id uuid,
  p_user_id uuid,
  p_session_id uuid,
  p_expected_state_version integer,
  p_next_state jsonb
)
returns void
language plpgsql
security definer set search_path = public, realtime
as $$
declare
  current_session public.game_sessions%rowtype;
begin
  select *
  into current_session
  from public.game_sessions
  where id = p_session_id
    and room_id = p_room_id
  for update;

  if not found then
    raise exception 'ROOM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if current_session.state_version <> p_expected_state_version then
    raise exception 'INVALID_VERSION' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = p_room_id and user_id = p_user_id
  ) then
    raise exception 'ALREADY_JOINED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = p_room_id and color = 'white'
  ) then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;

  if coalesce((p_next_state ->> 'stateVersion')::integer, -1)
       <> p_expected_state_version + 1
     or p_next_state ->> 'phase' <> 'playing' then
    raise exception 'INVALID_NEXT_STATE' using errcode = 'P0001';
  end if;

  insert into public.room_members (room_id, user_id, color)
  values (p_room_id, p_user_id, 'white');

  update public.game_sessions
  set
    state = p_next_state,
    state_version = p_expected_state_version + 1
  where id = p_session_id;

  update public.rooms
  set status = 'playing'
  where id = p_room_id;

  perform realtime.send(
    jsonb_build_object(
      'sessionId', p_session_id,
      'stateVersion', p_expected_state_version + 1
    ),
    'state_updated',
    'room:' || p_room_id::text,
    true
  );
end;
$$;

revoke all on function public.commit_othello_action(
  uuid, integer, uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.notify_room_state(uuid, uuid, integer)
from public, anon, authenticated;
revoke all on function public.commit_othello_room_join(
  uuid, uuid, uuid, integer, jsonb
) from public, anon, authenticated;

grant execute on function public.is_room_member(uuid) to authenticated, service_role;
grant execute on function public.commit_othello_action(
  uuid, integer, uuid, uuid, text, jsonb, jsonb
) to service_role;
grant execute on function public.notify_room_state(uuid, uuid, integer)
to service_role;
grant execute on function public.commit_othello_room_join(
  uuid, uuid, uuid, integer, jsonb
) to service_role;

create policy "room members can receive private room broadcasts"
on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1
    from public.room_members
    where user_id = auth.uid()
      and room_id::text = split_part(realtime.topic(), ':', 2)
  )
);
