alter table public.food_metadata
  add column if not exists title text not null default 'Food & Meal Planning',
  add column if not exists allergies_heading text not null default 'Allergies & Dietary Notes',
  add column if not exists kitchen_notes_heading text not null default 'Kitchen Notes',
  add column if not exists extra_requests_heading text not null default 'Extra Requests';

update public.food_metadata
set
  title = 'Food & Meal Planning',
  allergies_heading = 'Allergies & Dietary Notes',
  kitchen_notes_heading = 'Kitchen Notes',
  extra_requests_heading = 'Extra Requests'
where id = 1;
