-- Guiney: households, synced tables, last-write-wins and Row Level Security.
-- Run with `supabase db push`, or paste into the SQL editor of a new project.

-- Households ----------------------------------------------------------------

create table public.households (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 80),
  -- 40 random bits. Not readable through the API; see my_households().
  invite_code text not null unique
    default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  created_at timestamptz not null default now()
);

create table public.household_users (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_users_user on public.household_users (user_id);

-- Security definer, so policies can call it without recursing into RLS.
create function public.is_in_household(p_household uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_users
    where household_id = p_household and user_id = (select auth.uid())
  );
$$;

alter table public.households enable row level security;
alter table public.household_users enable row level security;

create policy "members read their household" on public.households
  for select to authenticated using (public.is_in_household(id));
create policy "members rename their household" on public.households
  for update to authenticated
  using (public.is_in_household(id)) with check (public.is_in_household(id));
create policy "members see who shares their household" on public.household_users
  for select to authenticated using (public.is_in_household(household_id));
create policy "people can leave" on public.household_users
  for delete to authenticated using (user_id = (select auth.uid()));

-- Joining only happens through the functions below.
revoke all on public.households, public.household_users from anon, authenticated;
grant select (id, name, created_at) on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select, delete on public.household_users to authenticated;

create function public.create_household(p_id uuid, p_name text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.households (id, name) values (p_id, p_name);
  insert into public.household_users (household_id, user_id) values (p_id, auth.uid());
  return query
    select h.id, h.name, h.invite_code from public.households h where h.id = p_id;
end;
$$;

create function public.join_household(p_code text)
returns table (id uuid, name text, invite_code text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  select h.id into target from public.households h
    where h.invite_code = upper(regexp_replace(p_code, '[^0-9A-Za-z]', '', 'g'));
  if target is null then
    raise exception 'No household has that invite code';
  end if;
  insert into public.household_users (household_id, user_id)
    values (target, auth.uid()) on conflict do nothing;
  return query
    select h.id, h.name, h.invite_code from public.households h where h.id = target;
end;
$$;

create function public.my_households()
returns table (id uuid, name text, invite_code text)
language sql stable security definer set search_path = ''
as $$
  select h.id, h.name, h.invite_code
  from public.households h
  join public.household_users u on u.household_id = h.id
  where u.user_id = (select auth.uid())
  order by u.joined_at desc;
$$;

/* Stops an old invite from working. */
create function public.rotate_invite_code(p_household uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  fresh text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
begin
  if not public.is_in_household(p_household) then
    raise exception 'Not a member of this household';
  end if;
  update public.households set invite_code = fresh where id = p_household;
  return fresh;
end;
$$;

-- Synced tables -------------------------------------------------------------
-- References are not foreign keys: rows arrive in whatever order devices come online.

create sequence public.sync_seq;

create table public.members (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  name text not null,
  avatar text not null,
  diet text not null default 'none',
  allergies jsonb not null default '[]',
  liked_ingredients jsonb not null default '[]',
  disliked_ingredients jsonb not null default '[]',
  preferred_cuisines jsonb not null default '[]',
  user_id uuid
);

create table public.recipes (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  title text not null,
  description text not null default '',
  -- Device paths stay on the device; the app does not send this column.
  photo_uri text,
  prep_time_min integer not null default 0,
  cook_time_min integer not null default 0,
  servings integer not null default 1,
  tags jsonb not null default '[]',
  category text not null,
  cuisine text not null default '',
  calories double precision,
  protein_g double precision,
  carbs_g double precision,
  fat_g double precision,
  copied_from_recipe_id uuid
);

create table public.recipe_ingredients (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  recipe_id uuid not null,
  name text not null,
  quantity double precision,
  unit text not null check (unit in ('g', 'ml', 'piece')),
  note text not null default '',
  position integer not null default 0
);

create table public.recipe_steps (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  recipe_id uuid not null,
  step_number integer not null,
  instruction text not null
);

create table public.fridge_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  name text not null,
  quantity double precision,
  unit text not null check (unit in ('g', 'ml', 'piece')),
  expiry_date date,
  added_at timestamptz not null,
  source text not null check (source in ('manual', 'grocery'))
);

create table public.precooked_meals (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  name text not null,
  recipe_id uuid,
  prepared_on date not null,
  expiry_date date,
  notes text not null default ''
);

create table public.meal_slots (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  name text not null,
  "order" integer not null
);

create table public.meal_plans (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  start_date date not null,
  end_date date not null,
  member_ids jsonb not null default '[]',
  check (end_date >= start_date)
);

create table public.meal_plan_entries (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  plan_id uuid not null,
  date date not null,
  slot_id uuid not null,
  recipe_id uuid,
  precooked_meal_id uuid,
  locked boolean not null default false,
  check ((recipe_id is null) <> (precooked_meal_id is null))
);

create table public.grocery_items (
  id uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  sync_seq bigint not null default 0,
  name text not null,
  quantity double precision,
  unit text not null check (unit in ('g', 'ml', 'piece')),
  source text not null check (source in ('plan', 'manual')),
  plan_id uuid,
  is_bought boolean not null default false,
  bought_at timestamptz
);

-- Last write wins -------------------------------------------------------------

create function public.apply_sync_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.household_id <> old.household_id then
      raise exception 'A row cannot move between households';
    end if;
    -- An older edit arriving late is dropped, not an error.
    if new.updated_at < old.updated_at then
      return null;
    end if;
  end if;
  new.sync_seq := nextval('public.sync_seq');
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'members', 'recipes', 'recipe_ingredients', 'recipe_steps', 'fridge_items',
    'precooked_meals', 'meal_slots', 'meal_plans', 'meal_plan_entries', 'grocery_items'
  ] loop
    execute format('create index %I on public.%I (household_id, sync_seq)', t || '_sync', t);
    execute format(
      'create trigger apply_sync_write before insert or update on public.%I
       for each row execute function public.apply_sync_write()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    -- No delete: rows are soft deleted so every device hears about it.
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format(
      'create policy "household reads" on public.%I for select to authenticated
       using (public.is_in_household(household_id))', t);
    execute format(
      'create policy "household adds" on public.%I for insert to authenticated
       with check (public.is_in_household(household_id))', t);
    execute format(
      'create policy "household edits" on public.%I for update to authenticated
       using (public.is_in_household(household_id))
       with check (public.is_in_household(household_id))', t);
  end loop;
end;
$$;

revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_in_household(uuid),
  public.create_household(uuid, text),
  public.join_household(text),
  public.my_households(),
  public.rotate_invite_code(uuid)
to authenticated;
