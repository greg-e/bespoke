create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  schedule_day_id uuid not null references public.schedule_days (id) on delete cascade,
  sequence integer not null,
  title text not null,
  time text,
  note text,
  assignment text,
  link text,
  attachment_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_day_id, sequence)
);

create index if not exists activities_day_idx on public.activities (schedule_day_id, sequence);

drop trigger if exists set_activities_updated_at on public.activities;
create trigger set_activities_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

do $$
begin
  if to_regclass('public.schedule_items') is not null then
    insert into public.activities (schedule_day_id, sequence, title, time, note)
    select schedule_day_id, item_order, title, time, note
    from public.schedule_items
    on conflict (schedule_day_id, sequence) do update
      set title = excluded.title,
          time = excluded.time,
          note = excluded.note,
          updated_at = now();

    drop table public.schedule_items;
  end if;
end;
$$;

alter table public.activities enable row level security;

drop policy if exists "Activities are readable by everyone" on public.activities;
create policy "Activities are readable by everyone"
on public.activities
for select
using (true);

drop policy if exists "Authenticated users can insert activities" on public.activities;
create policy "Authenticated users can insert activities"
on public.activities
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update activities" on public.activities;
create policy "Authenticated users can update activities"
on public.activities
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can delete activities" on public.activities;
create policy "Authenticated users can delete activities"
on public.activities
for delete
to authenticated
using (true);