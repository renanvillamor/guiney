-- More than one dish per meal. The same defaults as the app's own migration.
alter table public.meal_slots
  add column dishes integer not null default 1 check (dishes >= 1);

-- Without touching updated_at, so a newer edit waiting on a phone still wins.
update public.meal_slots set dishes = 2 where lower(trim(name)) in ('lunch', 'dinner');
