export async function unwrap(promise) {
  const { data, error } = await promise

  if (error) {
    throw error
  }

  return data
}

export function asText(error) {
  if (!error) return null
  return error instanceof Error ? error.message : String(error)
}
