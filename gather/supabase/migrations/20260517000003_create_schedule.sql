create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.schedule_days (
  id uuid primary key default gen_random_uuid(),
  day_date text not null,
  label text not null,
  short_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (day_date)
);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  schedule_day_id uuid not null references public.schedule_days (id) on delete cascade,
  item_order integer not null,
  time text,
  title text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_day_id, item_order)
);

create index if not exists schedule_days_date_idx on public.schedule_days (day_date);
create index if not exists schedule_items_day_idx on public.schedule_items (schedule_day_id, item_order);

create trigger set_schedule_days_updated_at
before update on public.schedule_days
for each row execute function public.set_updated_at();

create trigger set_schedule_items_updated_at
before update on public.schedule_items
for each row execute function public.set_updated_at();