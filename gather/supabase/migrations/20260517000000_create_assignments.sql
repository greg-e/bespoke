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

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  day text not null,
  type text not null,
  assignee text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assignments_day_idx on public.assignments (day);
create index if not exists assignments_type_idx on public.assignments (type);

create trigger set_assignments_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();