import { supabase } from './supabase'
import { unwrap } from './db'

export const eventFields = `
  id,
  title,
  notes,
  starts_at,
  ends_at,
  is_shared,
  created_by,
  created_at,
  updated_at
`

export function normalizeDateTime(value) {
  if (!value) return null

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toISOString()
}

export async function listEvents(filters = {}) {
  let query = supabase
    .from('events')
    .select(eventFields)
    .order('starts_at', { ascending: true, nullsFirst: false })

  if (filters.from) {
    query = query.gte('starts_at', normalizeDateTime(filters.from))
  }

  if (filters.to) {
    query = query.lte('starts_at', normalizeDateTime(filters.to))
  }

  if (filters.sharedOnly) {
    query = query.eq('is_shared', true)
  }

  return unwrap(query)
}

export async function getEventById(id) {
  return unwrap(supabase.from('events').select(eventFields).eq('id', id).single())
}

export async function createEvent(input) {
  return unwrap(
    supabase
      .from('events')
      .insert([
        {
          title: input.title.trim(),
          notes: input.notes?.trim() || null,
          starts_at: normalizeDateTime(input.starts_at),
          ends_at: normalizeDateTime(input.ends_at),
          is_shared: input.is_shared ?? false,
          created_by: input.created_by,
        },
      ])
      .select(eventFields)
      .single(),
  )
}

export async function updateEvent(id, patch) {
  return unwrap(
    supabase
      .from('events')
      .update({
        ...patch,
        starts_at: patch.starts_at ? normalizeDateTime(patch.starts_at) : patch.starts_at,
        ends_at: patch.ends_at ? normalizeDateTime(patch.ends_at) : patch.ends_at,
      })
      .eq('id', id)
      .select(eventFields)
      .single(),
  )
}

export async function deleteEvent(id) {
  return unwrap(supabase.from('events').delete().eq('id', id))
}

export async function listEventMembers(eventId) {
  return unwrap(
    supabase
      .from('event_members')
      .select('id,event_id,user_id,role,created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
  )
}

export async function addEventMember(eventId, userId, role = 'member') {
  return unwrap(
    supabase
      .from('event_members')
      .insert([{ event_id: eventId, user_id: userId, role }])
      .select('id,event_id,user_id,role,created_at')
      .single(),
  )
}

export async function removeEventMember(eventId, userId) {
  return unwrap(supabase.from('event_members').delete().eq('event_id', eventId).eq('user_id', userId))
}
