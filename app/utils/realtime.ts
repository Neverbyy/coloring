import { RealtimeClient } from '@supabase/realtime-js'

const SIGNAL_MIN_INTERVAL_MS = 5000
const SIGNAL_JITTER_MS = 1500

export interface RealtimeConfig {
  url: string
  key: string
}

export function listenSignal({ url, key }: RealtimeConfig, channelName: string, event: string, onSignal: () => void): () => void {
  const throttled = throttleSignal(onSignal, { minIntervalMs: SIGNAL_MIN_INTERVAL_MS, jitterMs: SIGNAL_JITTER_MS })
  const client = new RealtimeClient(`${url}/realtime/v1`, { params: { apikey: key } })
  let joined = false
  const channel = client.channel(channelName)
    .on('broadcast', { event }, throttled.trigger)
    .subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      if (joined) throttled.trigger()
      joined = true
    })

  return () => {
    throttled.cancel()
    client.removeChannel(channel).finally(() => client.disconnect())
  }
}
