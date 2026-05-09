import { supabase } from './supabase'
import { unwrap } from './db'

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  return data.session
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) throw error

  return data.user
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

export async function signInWithMagicLink(email) {
  return unwrap(
    supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    }),
  )
}

export async function signOut() {
  return unwrap(supabase.auth.signOut())
}
