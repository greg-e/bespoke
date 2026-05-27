alter table public.site_metadata
  add column if not exists what_to_bring text not null default '';

update public.site_metadata
set what_to_bring = ''
where id = 1 and what_to_bring is null;
