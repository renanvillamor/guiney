-- Where an imported recipe came from.
alter table public.recipes
  add column source_url text check (source_url is null or source_url ~ '^https?://');
