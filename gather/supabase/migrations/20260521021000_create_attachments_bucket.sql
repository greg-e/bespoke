insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "Gather attachments are publicly readable" on storage.objects;
create policy "Gather attachments are publicly readable"
on storage.objects
for select
using (bucket_id = 'attachments');

drop policy if exists "Authenticated users can upload gather attachments" on storage.objects;
create policy "Authenticated users can upload gather attachments"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'attachments');

drop policy if exists "Authenticated users can update gather attachments" on storage.objects;
create policy "Authenticated users can update gather attachments"
on storage.objects
for update
to authenticated
using (bucket_id = 'attachments')
with check (bucket_id = 'attachments');

drop policy if exists "Authenticated users can delete gather attachments" on storage.objects;
create policy "Authenticated users can delete gather attachments"
on storage.objects
for delete
to authenticated
using (bucket_id = 'attachments');
