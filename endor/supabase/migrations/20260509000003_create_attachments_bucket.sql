-- Create storage bucket and policies for event/task attachments.
-- This enables file upload/delete in the app's Event detail attachments UI.

insert into storage.buckets (id, name, public)
values ('endor-attachments', 'endor-attachments', true)
on conflict (id) do update
set public = excluded.public;

-- Recreate policies to keep this migration idempotent.
drop policy if exists "attachments object insert own folder" on storage.objects;
drop policy if exists "attachments object select own folder" on storage.objects;
drop policy if exists "attachments object update own folder" on storage.objects;
drop policy if exists "attachments object delete own folder" on storage.objects;

create policy "attachments object insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'endor-attachments'
  and (storage.foldername(name))[3] = auth.uid()::text
);

create policy "attachments object select own folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'endor-attachments'
  and (storage.foldername(name))[3] = auth.uid()::text
);

create policy "attachments object update own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'endor-attachments'
  and (storage.foldername(name))[3] = auth.uid()::text
)
with check (
  bucket_id = 'endor-attachments'
  and (storage.foldername(name))[3] = auth.uid()::text
);

create policy "attachments object delete own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'endor-attachments'
  and (storage.foldername(name))[3] = auth.uid()::text
);
