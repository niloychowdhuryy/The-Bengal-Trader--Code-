-- Every Google sign-in gets a profile. Players choose their public name; Google's
-- real name is never copied into it.

alter table public.profiles add column age_confirmed_at timestamptz;

create unique index profiles_display_name_unique
  on public.profiles (lower(display_name));

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- For anyone who signed in before this ran.
insert into public.profiles (id) select id from auth.users on conflict (id) do nothing;

-- The only way a player changes their profile. It uses the caller's verified identity,
-- so nobody can edit someone else's.
create function public.complete_profile(p_display_name text, p_age_confirmed boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'not-signed-in';
  end if;
  if p_age_confirmed is not true then
    raise exception 'age-required';
  end if;
  if v_name !~ '^[[:alnum:]]([[:alnum:] _''-]{0,22}[[:alnum:]])$' then
    raise exception 'name-invalid';
  end if;
  update public.profiles
  set display_name = v_name,
      age_confirmed_at = coalesce(age_confirmed_at, now())
  where id = auth.uid();
  if not found then
    raise exception 'profile-missing';
  end if;
exception
  when unique_violation then
    raise exception 'name-taken';
end;
$$;

revoke all on function public.complete_profile(text, boolean) from public, anon;
grant execute on function public.complete_profile(text, boolean) to authenticated;
