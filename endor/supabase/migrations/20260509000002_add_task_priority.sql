-- Add priority support for tasks.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'task_priority'
      and n.nspname = 'public'
  ) then
    create type public.task_priority as enum ('low', 'medium', 'high');
  end if;
end
$$;

alter table if exists public.tasks
  add column if not exists priority public.task_priority not null default 'medium';
