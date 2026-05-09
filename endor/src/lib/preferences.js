import { supabase } from './supabase'
import { unwrap } from './db'

export async function getNotificationPreferences(userId) {
  return unwrap(supabase.from('notification_preferences').select('*').eq('user_id', userId).maybeSingle())
}

export async function saveNotificationPreferences(userId, patch) {
  return unwrap(
    supabase
      .from('notification_preferences')
      .upsert([
        {
          user_id: userId,
          ...patch,
        },
      ])
      .select('*')
      .single(),
  )
}

export async function getProfile(userId) {
  return unwrap(supabase.from('profiles').select('*').eq('id', userId).maybeSingle())
}

export async function saveProfile(userId, patch) {
  return unwrap(
    supabase
      .from('profiles')
      .upsert([
        {
          id: userId,
          ...patch,
        },
      ])
      .select('*')
      .single(),
  )
}
