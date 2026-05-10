-- Fix infinite recursion between events and event_members RLS policies.
-- The original policies had mutual subqueries causing infinite recursion:
--   events SELECT → queries event_members → event_members SELECT → queries events → loop
-- Fix: use security definer functions to bypass RLS in each direction.

create or replace function public.is_event_member(p_event_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.event_members
    where event_id = p_event_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_event_owner(p_event_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.events
    where id = p_event_id and created_by = auth.uid()
  );
$$;

-- Rebuild events policies
drop policy if exists "events read own or shared" on public.events;
drop policy if exists "events update own or member" on public.events;

create policy "events read own or shared"
on public.events for select to authenticated
using (created_by = auth.uid() or public.is_event_member(events.id));

create policy "events update own or member"
on public.events for update to authenticated
using (created_by = auth.uid() or public.is_event_member(events.id))
with check (created_by = auth.uid() or public.is_event_member(events.id));

-- Rebuild event_members policies
drop policy if exists "event members read for related event" on public.event_members;
drop policy if exists "event members insert by owner" on public.event_members;
drop policy if exists "event members update by owner or self" on public.event_members;
drop policy if exists "event members delete by owner or self" on public.event_members;

create policy "event members read for related event"
on public.event_members for select to authenticated
using (user_id = auth.uid() or public.is_event_owner(event_members.event_id));

create policy "event members insert by owner"
on public.event_members for insert to authenticated
with check (user_id = auth.uid() or public.is_event_owner(event_id));

create policy "event members update by owner or self"
on public.event_members for update to authenticated
using (user_id = auth.uid() or public.is_event_owner(event_members.event_id))
with check (user_id = auth.uid() or public.is_event_owner(event_members.event_id));

create policy "event members delete by owner or self"
on public.event_members for delete to authenticated
using (user_id = auth.uid() or public.is_event_owner(event_members.event_id));
