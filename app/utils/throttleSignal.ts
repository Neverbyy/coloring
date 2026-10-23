export interface ThrottleSignalOptions {
  minIntervalMs: number
  jitterMs: number
  random?: () => number
}

export function throttleSignal(run: () => void, { minIntervalMs, jitterMs, random = Math.random }: ThrottleSignalOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = Number.NEGATIVE_INFINITY

  function trigger() {
    if (timer !== undefined) return
    const wait = Math.max(0, last + minIntervalMs - Date.now()) + random() * jitterMs
    timer = setTimeout(() => {
      timer = undefined
      last = Date.now()
      run()
    }, wait)
  }

  function cancel() {
    clearTimeout(timer)
    timer = undefined
  }

  return { trigger, cancel }
}
