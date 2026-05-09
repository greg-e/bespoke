create extension if not exists pgcrypto;

create type public.task_status as enum ('not_started', 'in_progress', 'done');
create type public.event_member_role as enum ('owner', 'member', 'viewer');
create type public.parent_type as enum ('task', 'event');
create type public.recurrence_kind as enum ('daily', 'weekly', 'monthly');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name);
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_shared boolean not null default false,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.event_member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  status public.task_status not null default 'not_started',
  due_date date,
  duration_minutes integer,
  is_pinned boolean not null default false,
  recurrence_rule text,
  recurrence_paused boolean not null default false,
  event_id uuid references public.events (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  assigned_to uuid references auth.users (id) on delete set null,
  is_linked_to_event boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_duration_positive check (duration_minutes is null or duration_minutes > 0)
);

create table if not exists public.event_checklist_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  converted_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  parent_type public.parent_type not null,
  parent_id uuid not null,
  file_name text not null,
  file_url text not null,
  mime_type text,
  file_size_bytes bigint,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  parent_type public.parent_type not null,
  parent_id uuid not null,
  body text not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_body_not_blank check (char_length(trim(body)) > 0)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  morning_time text not null default '08:00',
  evening_time text not null default '16:00',
  morning_enabled boolean not null default true,
  evening_enabled boolean not null default true,
  morning_snooze_minutes integer not null default 15,
  evening_snooze_minutes integer not null default 15,
  updated_at timestamptz not null default now()
);

create table if not exists public.task_review_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  review_date date not null default current_date,
  reason text not null,
  notes text,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Align partially-existing legacy tables to this schema before indexes/policies.
alter table if exists public.profiles
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.events
  add column if not exists title text,
  add column if not exists notes text,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists is_shared boolean default false,
  add column if not exists created_by uuid references auth.users (id) on delete cascade,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.tasks
  add column if not exists title text,
  add column if not exists notes text,
  add column if not exists status public.task_status default 'not_started',
  add column if not exists due_date date,
  add column if not exists duration_minutes integer,
  add column if not exists is_pinned boolean default false,
  add column if not exists recurrence_rule text,
  add column if not exists recurrence_paused boolean default false,
  add column if not exists event_id uuid references public.events (id) on delete set null,
  add column if not exists created_by uuid references auth.users (id) on delete cascade,
  add column if not exists assigned_to uuid references auth.users (id) on delete set null,
  add column if not exists is_linked_to_event boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.event_members
  add column if not exists role public.event_member_role default 'member',
  add column if not exists created_at timestamptz default now();

alter table if exists public.event_checklist_items
  add column if not exists title text,
  add column if not exists completed boolean default false,
  add column if not exists converted_task_id uuid references public.tasks (id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.attachments
  add column if not exists parent_type public.parent_type,
  add column if not exists parent_id uuid,
  add column if not exists file_name text,
  add column if not exists file_url text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists created_by uuid references auth.users (id) on delete cascade,
  add column if not exists created_at timestamptz default now();

alter table if exists public.comments
  add column if not exists parent_type public.parent_type,
  add column if not exists parent_id uuid,
  add column if not exists body text,
  add column if not exists created_by uuid references auth.users (id) on delete cascade,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.notification_preferences
  add column if not exists morning_time text default '08:00',
  add column if not exists evening_time text default '16:00',
  add column if not exists morning_enabled boolean default true,
  add column if not exists evening_enabled boolean default true,
  add column if not exists morning_snooze_minutes integer default 15,
  add column if not exists evening_snooze_minutes integer default 15,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.task_review_notes
  add column if not exists task_id uuid references public.tasks (id) on delete cascade,
  add column if not exists review_date date default current_date,
  add column if not exists reason text,
  add column if not exists notes text,
  add column if not exists created_by uuid references auth.users (id) on delete cascade,
  add column if not exists created_at timestamptz default now();

create index if not exists events_created_by_idx on public.events (created_by, starts_at);
create index if not exists event_members_user_idx on public.event_members (user_id, event_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by, due_date, status);
create index if not exists tasks_event_idx on public.tasks (event_id);
create index if not exists checklist_event_idx on public.event_checklist_items (event_id, created_at);
create index if not exists attachments_parent_idx on public.attachments (parent_type, parent_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_type, parent_id, created_at);
create index if not exists review_notes_task_idx on public.task_review_notes (task_id, review_date);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create trigger set_checklist_updated_at
before update on public.event_checklist_items
for each row execute function public.set_updated_at();

create trigger set_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create trigger handle_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.tasks enable row level security;
alter table public.event_checklist_items enable row level security;
alter table public.attachments enable row level security;
alter table public.comments enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.task_review_notes enable row level security;

create policy "profiles read own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles insert own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "profiles update own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "events read own or shared"
on public.events
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.event_members em
    where em.event_id = events.id
      and em.user_id = auth.uid()
  )
);

create policy "events insert own"
on public.events
for insert
to authenticated
with check (created_by = auth.uid());

create policy "events update own or member"
on public.events
for update
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.event_members em
    where em.event_id = events.id
      and em.user_id = auth.uid()
  )
)
with check (
  created_by = auth.uid()
  or exists (
    select 1
    from public.event_members em
    where em.event_id = events.id
      and em.user_id = auth.uid()
  )
);

create policy "events delete own"
on public.events
for delete
to authenticated
using (created_by = auth.uid());

create policy "event members read for related event"
on public.event_members
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.events e
    where e.id = event_members.event_id
      and e.created_by = auth.uid()
  )
  or exists (
    select 1
    from public.event_members em
    where em.event_id = event_members.event_id
      and em.user_id = auth.uid()
  )
);

create policy "event members insert by owner"
on public.event_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and e.created_by = auth.uid()
  )
  or user_id = auth.uid()
);

create policy "event members update by owner or self"
on public.event_members
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_members.event_id
      and e.created_by = auth.uid()
  )
  or user_id = auth.uid()
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_members.event_id
      and e.created_by = auth.uid()
  )
  or user_id = auth.uid()
);

create policy "event members delete by owner or self"
on public.event_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_members.event_id
      and e.created_by = auth.uid()
  )
  or user_id = auth.uid()
);

create policy "tasks read own or linked event"
on public.tasks
for select
to authenticated
using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1
    from public.events e
    where e.id = tasks.event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "tasks insert own"
on public.tasks
for insert
to authenticated
with check (created_by = auth.uid());

create policy "tasks update own or linked event"
on public.tasks
for update
to authenticated
using (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1
    from public.events e
    where e.id = tasks.event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
)
with check (
  created_by = auth.uid()
  or assigned_to = auth.uid()
  or exists (
    select 1
    from public.events e
    where e.id = tasks.event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "tasks delete own"
on public.tasks
for delete
to authenticated
using (created_by = auth.uid());

create policy "checklist read by event access"
on public.event_checklist_items
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_checklist_items.event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "checklist insert by event access"
on public.event_checklist_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "checklist update by event access"
on public.event_checklist_items
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_checklist_items.event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "checklist delete by event access"
on public.event_checklist_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = event_checklist_items.event_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "attachments read by related access"
on public.attachments
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.tasks t
    where attachments.parent_type = 'task'
      and t.id = attachments.parent_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or exists (
          select 1
          from public.events e
          where e.id = t.event_id
            and (
              e.created_by = auth.uid()
              or exists (
                select 1
                from public.event_members em
                where em.event_id = e.id
                  and em.user_id = auth.uid()
              )
            )
        )
      )
  )
  or exists (
    select 1
    from public.events e
    where attachments.parent_type = 'event'
      and e.id = attachments.parent_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "attachments insert own"
on public.attachments
for insert
to authenticated
with check (created_by = auth.uid());

create policy "attachments delete own"
on public.attachments
for delete
to authenticated
using (created_by = auth.uid());

create policy "comments read by related access"
on public.comments
for select
to authenticated
using (
  created_by = auth.uid()
  or exists (
    select 1
    from public.tasks t
    where comments.parent_type = 'task'
      and t.id = comments.parent_id
      and (
        t.created_by = auth.uid()
        or t.assigned_to = auth.uid()
        or exists (
          select 1
          from public.events e
          where e.id = t.event_id
            and (
              e.created_by = auth.uid()
              or exists (
                select 1
                from public.event_members em
                where em.event_id = e.id
                  and em.user_id = auth.uid()
              )
            )
        )
      )
  )
  or exists (
    select 1
    from public.events e
    where comments.parent_type = 'event'
      and e.id = comments.parent_id
      and (
        e.created_by = auth.uid()
        or exists (
          select 1
          from public.event_members em
          where em.event_id = e.id
            and em.user_id = auth.uid()
        )
      )
  )
);

create policy "comments insert own"
on public.comments
for insert
to authenticated
with check (created_by = auth.uid());

create policy "comments update own"
on public.comments
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "comments delete own"
on public.comments
for delete
to authenticated
using (created_by = auth.uid());

create policy "notification preferences read own"
on public.notification_preferences
for select
to authenticated
using (user_id = auth.uid());

create policy "notification preferences insert own"
on public.notification_preferences
for insert
to authenticated
with check (user_id = auth.uid());

create policy "notification preferences update own"
on public.notification_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "review notes read own"
on public.task_review_notes
for select
to authenticated
using (created_by = auth.uid());

create policy "review notes insert own"
on public.task_review_notes
for insert
to authenticated
with check (created_by = auth.uid());

create policy "review notes update own"
on public.task_review_notes
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

create policy "review notes delete own"
on public.task_review_notes
for delete
to authenticated
using (created_by = auth.uid());

do $$
begin
  if to_regclass('public.profiles') is not null then
    insert into public.notification_preferences (user_id)
    select id from public.profiles
    on conflict (user_id) do nothing;
  end if;
end $$;
