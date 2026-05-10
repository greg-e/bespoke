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

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export function buildAttachmentPath({ parentType, parentId, userId, fileName }) {
  const safeName = sanitizeFileName(fileName)
  const stamp = Date.now()
  return `${parentType}/${parentId}/${userId}/${stamp}-${safeName}`
}

export function resolveAttachmentUrl(fileUrl, bucket = attachmentsBucket) {
  if (!fileUrl) return ''
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl

  const { data } = supabase.storage.from(bucket).getPublicUrl(fileUrl)
  return data?.publicUrl || fileUrl
}

export function extractStoragePath(fileUrl, bucket = attachmentsBucket) {
  if (!fileUrl) return null
  if (!/^https?:\/\//i.test(fileUrl)) return fileUrl

  try {
    const parsed = new URL(fileUrl)
    const patterns = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/${bucket}/`,
    ]

    for (const marker of patterns) {
      const index = parsed.pathname.indexOf(marker)
      if (index !== -1) {
        return decodeURIComponent(parsed.pathname.slice(index + marker.length))
      }
    }
  } catch {
    return null
  }

  return null
}

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

export async function deleteAttachmentFile(path, bucket = attachmentsBucket) {
  return unwrap(supabase.storage.from(bucket).remove([path]))
}

export async function deleteAttachment(id) {
  return unwrap(supabase.from('attachments').delete().eq('id', id))
}

export async function deleteAttachmentAndFile(attachment, bucket = attachmentsBucket) {
  const storagePath = extractStoragePath(attachment.file_url, bucket)

  if (storagePath) {
    await deleteAttachmentFile(storagePath, bucket)
  }

  return deleteAttachment(attachment.id)
}
