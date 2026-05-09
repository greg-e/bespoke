import { supabase } from './supabase'
import { unwrap } from './db'
import { createTask } from './tasks'

export const checklistFields = `
  id,
  event_id,
  title,
  completed,
  converted_task_id,
  created_at,
  updated_at
`

export async function listChecklistItemsForEvent(eventId) {
  return unwrap(
    supabase
      .from('event_checklist_items')
      .select(checklistFields)
      .eq('event_id', eventId)
      .order('created_at', { ascending: true }),
  )
}

export async function createChecklistItem(eventId, title) {
  return unwrap(
    supabase
      .from('event_checklist_items')
      .insert([{ event_id: eventId, title: title.trim() }])
      .select(checklistFields)
      .single(),
  )
}

export async function updateChecklistItem(id, patch) {
  return unwrap(
    supabase.from('event_checklist_items').update(patch).eq('id', id).select(checklistFields).single(),
  )
}

export async function deleteChecklistItem(id) {
  return unwrap(supabase.from('event_checklist_items').delete().eq('id', id))
}

export async function convertChecklistItemToTask(checklistItem, input = {}) {
  const createdTask = await createTask({
    title: input.title ?? checklistItem.title,
    notes: input.notes ?? null,
    due_date: input.due_date ?? null,
    duration_minutes: input.duration_minutes ?? null,
    event_id: checklistItem.event_id,
    is_linked_to_event: true,
    created_by: input.created_by,
    assigned_to: input.assigned_to ?? null,
  })

  const updatedChecklistItem = await updateChecklistItem(checklistItem.id, {
    converted_task_id: createdTask.id,
  })

  return { createdTask, checklistItem: updatedChecklistItem }
}
