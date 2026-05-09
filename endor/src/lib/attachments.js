import { supabase } from './supabase'
import { unwrap } from './db'

export const attachmentsBucket = 'endor-attachments'

export const attachmentFields = `
  id,
  parent_type,
  parent_id,
  file_name,
  file_url,
  mime_type,
  file_size_bytes,
  created_by,
  created_at
`

export async function listAttachments(parentType, parentId) {
  return unwrap(
    supabase
      .from('attachments')
      .select(attachmentFields)
      .eq('parent_type', parentType)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true }),
  )
}

export async function createAttachmentRecord(input) {
  return unwrap(
    supabase
      .from('attachments')
      .insert([
        {
          parent_type: input.parent_type,
          parent_id: input.parent_id,
          file_name: input.file_name,
          file_url: input.file_url,
          mime_type: input.mime_type ?? null,
          file_size_bytes: input.file_size_bytes ?? null,
          created_by: input.created_by,
        },
      ])
      .select(attachmentFields)
      .single(),
  )
}

export async function uploadAttachmentFile({ bucket = attachmentsBucket, path, file }) {
  return unwrap(supabase.storage.from(bucket).upload(path, file, { upsert: false }))
}

export async function deleteAttachment(id) {
  return unwrap(supabase.from('attachments').delete().eq('id', id))
}
