import { supabase } from './supabase'
import { unwrap } from './db'

export const taskFields = `
  id,
  title,
  notes,
  status,
  due_date,
  duration_minutes,
  is_pinned,
  recurrence_rule,
  recurrence_paused,
  event_id,
  created_by,
  assigned_to,
  is_linked_to_event,
  created_at,
  updated_at
`

export function normalizeTaskInput(input) {
  return {
    title: input.title.trim(),
    notes: input.notes?.trim() || null,
    status: input.status ?? 'not_started',
    due_date: input.due_date || null,
    duration_minutes: input.duration_minutes ?? null,
    is_pinned: input.is_pinned ?? false,
    recurrence_rule: input.recurrence_rule || null,
    recurrence_paused: input.recurrence_paused ?? false,
    event_id: input.event_id ?? null,
    created_by: input.created_by,
    assigned_to: input.assigned_to ?? null,
    is_linked_to_event: input.is_linked_to_event ?? Boolean(input.event_id),
  }
}

export async function listTasks(filters = {}) {
  let query = supabase
    .from('tasks')
    .select(taskFields)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (filters.eventId) {
    query = query.eq('event_id', filters.eventId)
  }

  if (filters.excludeDone) {
    query = query.neq('status', 'done')
  }

  if (filters.dueDate) {
    query = query.eq('due_date', filters.dueDate)
  }

  if (filters.dueBefore) {
    query = query.lte('due_date', filters.dueBefore)
  }

  if (filters.dueAfter) {
    query = query.gte('due_date', filters.dueAfter)
  }

  if (filters.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }

  return unwrap(query)
}

export async function getTaskById(id) {
  return unwrap(supabase.from('tasks').select(taskFields).eq('id', id).single())
}

export async function createTask(input) {
  return unwrap(
    supabase
      .from('tasks')
      .insert([normalizeTaskInput(input)])
      .select(taskFields)
      .single(),
  )
}

export async function updateTask(id, patch) {
  return unwrap(
    supabase.from('tasks').update(patch).eq('id', id).select(taskFields).single(),
  )
}

export async function deleteTask(id) {
  return unwrap(supabase.from('tasks').delete().eq('id', id))
}

export async function toggleTaskStatus(id, status) {
  return updateTask(id, { status })
}

export async function pinTask(id, isPinned = true) {
  return updateTask(id, { is_pinned: isPinned })
}

export async function linkTaskToEvent(taskId, eventId) {
  return updateTask(taskId, { event_id: eventId, is_linked_to_event: Boolean(eventId) })
}

export async function unlinkTaskFromEvent(taskId) {
  return updateTask(taskId, { event_id: null, is_linked_to_event: false })
}
