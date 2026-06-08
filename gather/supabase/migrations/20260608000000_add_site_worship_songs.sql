alter table public.site_metadata
  add column if not exists worship_songs text not null default '';

update public.site_metadata
set worship_songs = ''
where id = 1 and worship_songs is null;
