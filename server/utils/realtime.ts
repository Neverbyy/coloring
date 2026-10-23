const BROADCAST_TIMEOUT_MS = 3000

export async function broadcastSignal(channel: string, event: string): Promise<void> {
  const { supabaseSecretKey, public: { supabaseUrl } } = useRuntimeConfig()
  if (!supabaseUrl || !supabaseSecretKey) return
  try {
    await $fetch(`${supabaseUrl}/realtime/v1/api/broadcast/${encodeURIComponent(channel)}/events/${encodeURIComponent(event)}`, {
      method: 'POST',
      headers: { apikey: supabaseSecretKey },
      body: {},
      timeout: BROADCAST_TIMEOUT_MS
    })
  } catch (error) {
    console.warn('Realtime broadcast failed', channel, event, error instanceof Error ? error.message : error)
  }
}
