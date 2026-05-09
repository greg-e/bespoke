import { supabase } from './supabase'
import { unwrap } from './db'

export const commentFields = `
  id,
  parent_type,
  parent_id,
  body,
  created_by,
  created_at,
  updated_at
`

export async function listComments(parentType, parentId) {
  return unwrap(
    supabase
      .from('comments')
      .select(commentFields)
      .eq('parent_type', parentType)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true }),
  )
}

export async function createComment(input) {
  return unwrap(
    supabase
      .from('comments')
      .insert([
        {
          parent_type: input.parent_type,
          parent_id: input.parent_id,
          body: input.body.trim(),
          created_by: input.created_by,
        },
      ])
      .select(commentFields)
      .single(),
  )
}

export async function updateComment(id, body) {
  return unwrap(supabase.from('comments').update({ body: body.trim() }).eq('id', id).select(commentFields).single())
}

export async function deleteComment(id) {
  return unwrap(supabase.from('comments').delete().eq('id', id))
}
