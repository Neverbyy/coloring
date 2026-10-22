import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HistorySync, type SyncStatus } from '../layers/coloring/app/engine/sync'
import type { DrawingState, HistoryOp } from '../layers/coloring/shared/history'

const KEY = 'coloring:v3:user:cat'
const URL = '/api/coloring/arts/cat/history'
const op1: HistoryOp = { t: 'clear', p: [1, 1] }
const op2: HistoryOp = { t: 'clear', p: [2, 2] }
const EMPTY: DrawingState = { baseSeq: 0, hasBase: false, ops: [], cursor: 0, progress: 0 }

class MemoryStorage {
  private items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.items.set(key, value)
  }

  removeItem(key: string) {
    this.items.delete(key)
  }
}

const listeners = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() })
const httpError = (statusCode: number, data?: unknown) => Object.assign(new Error(`HTTP ${statusCode}`), { statusCode, data })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock = vi.fn()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('window', listeners())
  vi.stubGlobal('document', { visibilityState: 'visible', ...listeners() })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function createSync() {
  const state = { baseSeq: 0, ops: [] as HistoryOp[], cursor: 0, progress: 0 }
  const statuses: SyncStatus[] = []
  const onUnauthorized = vi.fn()
  const sync = new HistorySync({
    artId: 'cat',
    storageKey: KEY,
    source: {
      baseSeq: () => state.baseSeq,
      baseImage: () => null,
      ops: () => state.ops,
      cursor: () => state.cursor,
      progress: () => state.progress
    },
    onStatus: status => statuses.push(status),
    onUnauthorized
  })
  return { state, statuses, sync, onUnauthorized }
}

const pending = () => {
  const raw = localStorage.getItem(KEY)
  return raw ? JSON.parse(raw) : null
}

describe('автосохранение рисунка', () => {
  it('без сети работа лежит в браузере, повторы — с растущей паузой, после успеха хвост убирается', async () => {
    const { state, statuses, sync } = createSync()
    fetchMock
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValue({})
    await sync.restore(EMPTY, null)

    Object.assign(state, { ops: [op1], cursor: 1, progress: 5 })
    sync.changed()
    expect(pending()).toMatchObject({ fromSeq: 0, ops: [op1], cursor: 1 })

    await vi.advanceTimersByTimeAsync(700)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(statuses).toContain('offline')

    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3999)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)

    expect(fetchMock).toHaveBeenLastCalledWith(URL, expect.objectContaining({
      method: 'POST',
      body: { fromSeq: 0, ops: [op1], cursor: 1, progress: 5 }
    }))
    expect(statuses.at(-1)).toBe('saved')
    expect(pending()).toBeNull()
  })

  it('после перезагрузки неотправленный хвост продолжает историю сервера и досылается', async () => {
    localStorage.setItem(KEY, JSON.stringify({ baseSeq: 0, baseUnsent: false, fromSeq: 1, ops: [op2], cursor: 2, progress: 10, savedAt: 1 }))
    fetchMock.mockResolvedValue({})
    const { state, sync } = createSync()

    const restored = await sync.restore({ ...EMPTY, ops: [op1], cursor: 1, progress: 4 }, null)
    expect(restored).toEqual({ baseSeq: 0, baseImage: null, ops: [op1, op2], cursor: 2, progress: 10 })

    Object.assign(state, { ops: restored.ops, cursor: restored.cursor, progress: restored.progress })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith(URL, expect.objectContaining({ body: { fromSeq: 1, ops: [op2], cursor: 2, progress: 10 } }))
    expect(pending()).toBeNull()
  })

  it('хвост от устаревшей версии истории не накладывается на новую с сервера', async () => {
    localStorage.setItem(KEY, JSON.stringify({ baseSeq: 0, baseUnsent: false, fromSeq: 1, ops: [op2], cursor: 2, progress: 10, savedAt: 1 }))
    const { sync } = createSync()
    const server: DrawingState = { baseSeq: 20, hasBase: true, ops: [op1], cursor: 21, progress: 40 }

    const restored = await sync.restore(server, null)
    expect(restored).toEqual({ baseSeq: 20, baseImage: null, ops: [op1], cursor: 21, progress: 40 })
    expect(pending()).toBeNull()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('409: история выравнивается по серверу и отправляется заново целиком', async () => {
    const { state, statuses, sync } = createSync()
    fetchMock.mockRejectedValueOnce(httpError(409, { data: { baseSeq: 0, head: 0 } })).mockResolvedValue({})
    await sync.restore({ ...EMPTY, ops: [op1], cursor: 1 }, null)

    Object.assign(state, { ops: [op1, op2], cursor: 2, progress: 8 })
    sync.changed()
    await vi.advanceTimersByTimeAsync(700)
    await vi.advanceTimersByTimeAsync(10)

    expect(fetchMock).toHaveBeenNthCalledWith(1, URL, expect.objectContaining({ body: { fromSeq: 1, ops: [op2], cursor: 2, progress: 8 } }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, URL, expect.objectContaining({ body: { fromSeq: 0, ops: [op1, op2], cursor: 2, progress: 8 } }))
    expect(statuses.at(-1)).toBe('saved')
  })

  it('401: игрока ведут на вход, повторов нет, работа остаётся в браузере', async () => {
    const { state, sync, onUnauthorized } = createSync()
    fetchMock.mockRejectedValue(httpError(401))
    await sync.restore(EMPTY, null)

    Object.assign(state, { ops: [op1], cursor: 1, progress: 3 })
    sync.changed()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(pending()).toMatchObject({ ops: [op1], cursor: 1 })
  })

  it('при уходе со страницы несохранённое уходит сразу, с keepalive', async () => {
    const { state, sync } = createSync()
    fetchMock.mockResolvedValue({})
    await sync.restore(EMPTY, null)

    Object.assign(state, { ops: [op1], cursor: 1, progress: 2 })
    sync.changed()
    sync.dispose()

    expect(fetchMock).toHaveBeenCalledWith(URL, expect.objectContaining({ keepalive: true, body: { fromSeq: 0, ops: [op1], cursor: 1, progress: 2 } }))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
