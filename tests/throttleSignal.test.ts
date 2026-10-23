import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { throttleSignal } from '../app/utils/throttleSignal'

const OPTIONS = { minIntervalMs: 5000, jitterMs: 1500 }

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('сигнал «галерея изменилась»', () => {
  it('первый сигнал срабатывает с разбросом до jitterMs, чтобы игроки не спрашивали сервер разом', () => {
    const run = vi.fn()
    throttleSignal(run, { ...OPTIONS, random: () => 0.5 }).trigger()

    vi.advanceTimersByTime(749)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('пачка сигналов — один перезапрос', () => {
    const run = vi.fn()
    const signal = throttleSignal(run, { ...OPTIONS, random: () => 1 })
    for (let i = 0; i < 100; i++) signal.trigger()

    vi.advanceTimersByTime(10_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('поток сигналов — не чаще раза в minIntervalMs', () => {
    const run = vi.fn()
    const signal = throttleSignal(run, { ...OPTIONS, random: () => 0 })
    const stop = setInterval(signal.trigger, 100)

    vi.advanceTimersByTime(20_000)
    clearInterval(stop)
    expect(run).toHaveBeenCalledTimes(4)
  })

  it('отписка отменяет запланированный перезапрос', () => {
    const run = vi.fn()
    const signal = throttleSignal(run, { ...OPTIONS, random: () => 0.5 })
    signal.trigger()
    signal.cancel()

    vi.advanceTimersByTime(10_000)
    expect(run).not.toHaveBeenCalled()
  })
})
