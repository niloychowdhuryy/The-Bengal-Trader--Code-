-- Foundation for accounts and verified saves. Players may read their own records.
-- All writes go through server functions using the service role, whose key is held
-- only in Supabase's secrets.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now()
);

create table public.game_states (
  player_id uuid primary key references public.profiles (id) on delete cascade,
  state jsonb not null,
  schema_version integer not null check (schema_version > 0),
  revision bigint not null default 0 check (revision >= 0),
  last_seq bigint not null default 0 check (last_seq >= 0),
  last_at bigint not null default 0 check (last_at >= 0),
  -- Saves with no verifiable history stay playable but are never ranked.
  provenance text not null check (provenance in ('verified', 'imported')),
  updated_at timestamptz not null default now()
);

create table public.command_batches (
  player_id uuid not null references public.profiles (id) on delete cascade,
  batch_id uuid not null,
  first_seq bigint not null check (first_seq >= 1),
  last_seq bigint not null,
  revision bigint not null,
  commands jsonb not null check (jsonb_typeof(commands) = 'array'),
  received_at timestamptz not null default now(),
  primary key (player_id, batch_id),
  unique (player_id, first_seq),
  check (last_seq >= first_seq)
);

create table public.save_backups (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.profiles (id) on delete cascade,
  state jsonb not null,
  revision bigint not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index save_backups_player_created on public.save_backups (player_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.game_states enable row level security;
alter table public.command_batches enable row level security;
alter table public.save_backups enable row level security;

revoke all on public.profiles, public.game_states, public.command_batches, public.save_backups
  from public, anon, authenticated;
grant select on public.profiles, public.game_states, public.save_backups to authenticated;

create policy "Players read their own profile" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Players read their own game" on public.game_states
  for select to authenticated using (player_id = auth.uid());
create policy "Players read their own backups" on public.save_backups
  for select to authenticated using (player_id = auth.uid());
-- command_batches has no policy: clients can't read or write it.

-- Saves a verified batch only if nobody else has moved the game on since it was read.
create function public.commit_sync(
  p_player_id uuid,
  p_expected_revision bigint,
  p_state jsonb,
  p_schema_version integer,
  p_last_seq bigint,
  p_last_at bigint,
  p_batch_id uuid,
  p_first_seq bigint,
  p_commands jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.game_states
  set state = p_state,
      schema_version = p_schema_version,
      revision = p_expected_revision + 1,
      last_seq = p_last_seq,
      last_at = p_last_at,
      updated_at = now()
  where player_id = p_player_id and revision = p_expected_revision;
  if not found then
    return false;
  end if;
  insert into public.command_batches
    (player_id, batch_id, first_seq, last_seq, revision, commands)
  values
    (p_player_id, p_batch_id, p_first_seq, p_last_seq, p_expected_revision + 1, p_commands);
  return true;
end;
$$;

revoke all on function public.commit_sync(uuid, bigint, jsonb, integer, bigint, bigint, uuid, bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_sync(uuid, bigint, jsonb, integer, bigint, bigint, uuid, bigint, jsonb)
  to service_role;
