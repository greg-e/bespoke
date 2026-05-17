alter table public.assignments enable row level security;

create policy "Assignments are readable by everyone"
on public.assignments
for select
using (true);

create policy "Authenticated users can insert assignments"
on public.assignments
for insert
to authenticated
with check (true);

create policy "Authenticated users can update assignments"
on public.assignments
for update
to authenticated
using (true)
with check (true);

create policy "Authenticated users can delete assignments"
on public.assignments
for delete
to authenticated
using (true);