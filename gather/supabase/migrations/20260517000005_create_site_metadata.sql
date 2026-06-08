create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.site_metadata (
  id integer primary key default 1,
  title text not null,
  subtitle text,
  date_start date not null,
  date_end date not null,
  location_name text not null,
  address_line1 text not null,
  address_line2 text not null,
  map_open_url text not null,
  map_embed_url text,
  what_to_bring text not null default '',
  worship_songs text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_metadata_singleton check (id = 1)
);

insert into public.site_metadata (
  id,
  title,
  subtitle,
  date_start,
  date_end,
  location_name,
  address_line1,
  address_line2,
  map_open_url,
  map_embed_url,
  what_to_bring,
  worship_songs
)
values (
  1,
  'Gather ''26',
  '',
  '2026-06-22',
  '2026-06-27',
  'Lake House',
  '64 Deerpath',
  'Tracy, MN 56175',
  'https://www.google.com/maps/search/?api=1&query=64+Deerpath,+Tracy,+MN+56175',
  'https://www.google.com/maps?q=64+Deerpath,+Tracy,+MN+56175&output=embed',
  '',
  ''
)
on conflict (id) do update
  set title = excluded.title,
      subtitle = excluded.subtitle,
      date_start = excluded.date_start,
      date_end = excluded.date_end,
      location_name = excluded.location_name,
      address_line1 = excluded.address_line1,
      address_line2 = excluded.address_line2,
      map_open_url = excluded.map_open_url,
      map_embed_url = excluded.map_embed_url,
      what_to_bring = excluded.what_to_bring,
      worship_songs = excluded.worship_songs,
      updated_at = now();

create trigger set_site_metadata_updated_at
before update on public.site_metadata
for each row execute function public.set_updated_at();