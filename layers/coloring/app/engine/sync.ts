import { errorStatus } from '~/utils/httpError'
import { artApiPath } from '#layers/coloring/shared/gallery'
import type { DrawingState, HistoryConflict, HistoryOp, HistorySave } from '#layers/coloring/shared/history'
import { readStorage, removeStorage, writeStorage } from '~/utils/storage'

export function pendingStorageKey(userId: string, artId: string): string {
  return `coloring:v3:${userId}:${artId}`
}

export function forgetPending(storageKey: string) {
  removeStorage(storageKey)
  removeStorage(`${storageKey}:base`)
}

export type SyncStatus = 'saved' | 'saving' | 'offline'

export interface SyncSource {
  baseSeq: () => number
  baseImage: () => Blob | null
  ops: () => HistoryOp[]
  cursor: () => number
  progress: () => number
}

export interface SyncOptions {
  artId: string
  storageKey: string
  source: SyncSource
  onStatus: (status: SyncStatus) => void
  onUnauthorized: () => void
}

export interface RestoredState {
  baseSeq: number
  baseImage: Blob | null
  ops: HistoryOp[]
  cursor: number
  progress: number
}

interface PendingState {
  baseSeq: number
  baseUnsent: boolean
  fromSeq: number
  ops: HistoryOp[]
  cursor: number
  progress: number
  savedAt: number
}

const DEBOUNCE_MS = 700
const RETRY_MIN_MS = 2000
const RETRY_MAX_MS = 30_000
const KEEPALIVE_MAX_BYTES = 60 * 1024

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

export class HistorySync {
  private syncedPrefix = 0
  private syncedCursor = 0
  private syncedProgress = 0
  private baseUnsent = false
  private baseStored = false
  private thumbnail: Blob | null = null
  private truncatedDuringSend: number | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private retryDelay = RETRY_MIN_MS
  private running: Promise<void> | null = null
  private disposed = false
  private readonly onOnline = () => this.schedule(0)
  private readonly onHidden = () => {
    if (document.visibilityState === 'hidden') this.schedule(0)
  }

  constructor(private readonly options: SyncOptions) {
    window.addEventListener('online', this.onOnline)
    document.addEventListener('visibilitychange', this.onHidden)
  }

  private url(path: string): string {
    return artApiPath(this.options.artId, path)
  }

  private get baseKey(): string {
    return `${this.options.storageKey}:base`
  }

  async restore(server: DrawingState, serverBase: Blob | null): Promise<RestoredState> {
    const serverHead = server.baseSeq + server.ops.length
    this.syncedPrefix = serverHead
    this.syncedCursor = server.cursor
    this.syncedProgress = server.progress
    const fromServer: RestoredState = {
      baseSeq: server.baseSeq,
      baseImage: serverBase,
      ops: server.ops,
      cursor: server.cursor,
      progress: server.progress
    }

    const pending = this.readPending()
    if (!pending) return fromServer

    let baseImage: Blob | null = null
    if (pending.baseUnsent) {
      const stored = readStorage(this.baseKey)
      if (pending.baseSeq > 0 && !stored) return this.discardPending(fromServer)
      baseImage = stored ? await dataUrlToBlob(stored) : null
    } else if (pending.baseSeq === server.baseSeq) {
      baseImage = serverBase
    } else {
      return this.discardPending(fromServer)
    }

    const known = pending.fromSeq > pending.baseSeq
    if (known && (server.baseSeq > pending.baseSeq || serverHead < pending.fromSeq)) {
      return this.discardPending(fromServer)
    }
    const prefix = known ? server.ops.slice(pending.baseSeq - server.baseSeq, pending.fromSeq - server.baseSeq) : []

    this.syncedPrefix = pending.fromSeq
    this.baseUnsent = pending.baseUnsent
    this.baseStored = pending.baseUnsent
    this.schedule(0)
    return {
      baseSeq: pending.baseSeq,
      baseImage,
      ops: [...prefix, ...pending.ops],
      cursor: pending.cursor,
      progress: pending.progress
    }
  }

  changed(truncatedTo?: number) {
    if (truncatedTo !== undefined) {
      this.syncedPrefix = Math.min(this.syncedPrefix, truncatedTo)
      this.truncatedDuringSend = Math.min(this.truncatedDuringSend ?? truncatedTo, truncatedTo)
    }
    this.writePending()
    this.schedule(DEBOUNCE_MS)
  }

  baked(image: Blob) {
    this.baseUnsent = true
    this.baseStored = false
    blobToDataUrl(image).then((url) => {
      if (this.options.source.baseImage() !== image || !this.baseUnsent) return
      if (!writeStorage(this.baseKey, url)) return
      this.baseStored = true
      this.writePending()
    }).catch(() => {})
    this.schedule(DEBOUNCE_MS)
  }

  queueThumbnail(image: Blob) {
    this.thumbnail = image
    this.schedule(DEBOUNCE_MS)
  }

  dispose(lastThumbnail?: Promise<Blob | null>) {
    this.disposed = true
    clearTimeout(this.timer)
    window.removeEventListener('online', this.onOnline)
    document.removeEventListener('visibilitychange', this.onHidden)
    const flush = () => {
      const history = !this.baseUnsent && this.dirty ? this.sendHistory(true).catch(() => {}) : undefined
      Promise.all([lastThumbnail ?? this.thumbnail, history]).then(([image]) => {
        if (image) return this.sendThumbnail(image)
      }).catch(() => {})
    }
    if (this.running) this.running.then(flush)
    else flush()
  }

  private get dirty(): boolean {
    const { source } = this.options
    return source.baseSeq() + source.ops().length !== this.syncedPrefix
      || source.cursor() !== this.syncedCursor
      || source.progress() !== this.syncedProgress
  }

  private schedule(delay: number) {
    if (this.disposed) return
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.run(), delay)
  }

  private run() {
    if (this.running || this.disposed) return
    this.running = this.cycle().finally(() => {
      this.running = null
    })
  }

  private async cycle() {
    try {
      if (this.baseUnsent || this.dirty) this.options.onStatus('saving')
      if (this.baseUnsent) await this.sendBase()
      if (this.dirty) await this.sendHistory()
      if (this.thumbnail) {
        const image = this.thumbnail
        await this.sendThumbnail(image)
        if (this.thumbnail === image) this.thumbnail = null
      }
      this.retryDelay = RETRY_MIN_MS
      const pending = this.baseUnsent || this.dirty
      this.options.onStatus(pending ? 'saving' : 'saved')
      if (pending || this.thumbnail) this.schedule(0)
    } catch (error) {
      this.handleError(error)
    }
  }

  private handleError(error: unknown) {
    const status = errorStatus(error)
    if (status === 401) {
      this.options.onUnauthorized()
      return
    }
    if (status === 409 || status === 413) {
      const conflict = (error as { data?: { data?: HistoryConflict } }).data?.data
      const localBase = this.options.source.baseSeq()
      if (conflict && localBase >= conflict.baseSeq && localBase <= conflict.head && status === 409) {
        this.syncedPrefix = Math.max(localBase, Math.min(this.syncedPrefix, conflict.head))
      } else {
        this.baseUnsent = true
      }
      this.schedule(0)
      return
    }
    this.options.onStatus('offline')
    this.schedule(this.retryDelay)
    this.retryDelay = Math.min(this.retryDelay * 2, RETRY_MAX_MS)
  }

  private async sendBase() {
    const { source } = this.options
    const seq = source.baseSeq()
    const image = source.baseImage()
    const { head } = await $fetch<{ head: number }>(this.url(`/base/${seq}`), {
      method: 'PUT',
      body: seq > 0 && image ? image : undefined,
      headers: { 'content-type': 'image/png' }
    })
    this.syncedPrefix = Math.min(Math.max(this.syncedPrefix, seq), head)
    if (source.baseSeq() === seq) {
      this.baseUnsent = false
      this.baseStored = false
      removeStorage(this.baseKey)
    }
    this.writePending()
  }

  private async sendHistory(keepalive = false) {
    const { source } = this.options
    const baseSeq = source.baseSeq()
    const fromSeq = Math.max(this.syncedPrefix, baseSeq)
    const save: HistorySave = {
      fromSeq,
      ops: source.ops().slice(fromSeq - baseSeq),
      cursor: source.cursor(),
      progress: source.progress()
    }
    this.truncatedDuringSend = null
    await $fetch(this.url('/history'), {
      method: 'POST',
      body: save,
      keepalive: keepalive && JSON.stringify(save).length <= KEEPALIVE_MAX_BYTES
    })

    this.syncedPrefix = Math.min(fromSeq + save.ops.length, this.truncatedDuringSend ?? Number.POSITIVE_INFINITY)
    this.truncatedDuringSend = null
    this.syncedCursor = save.cursor
    this.syncedProgress = save.progress
    if (this.dirty || this.baseUnsent) this.writePending()
    else this.clearPending()
  }

  private sendThumbnail(image: Blob) {
    return $fetch(this.url('/thumbnail'), {
      method: 'PUT',
      body: image,
      headers: { 'content-type': 'image/jpeg' }
    })
  }

  private readPending(): PendingState | null {
    const raw = readStorage(this.options.storageKey)
    try {
      return raw ? JSON.parse(raw) as PendingState : null
    } catch {
      return null
    }
  }

  private writePending() {
    const { source } = this.options
    const baseSeq = source.baseSeq()
    if (this.baseUnsent && baseSeq > 0 && !this.baseStored) return
    const fromSeq = Math.max(this.syncedPrefix, baseSeq)
    const pending: PendingState = {
      baseSeq,
      baseUnsent: this.baseUnsent,
      fromSeq,
      ops: source.ops().slice(fromSeq - baseSeq),
      cursor: source.cursor(),
      progress: source.progress(),
      savedAt: Date.now()
    }
    writeStorage(this.options.storageKey, JSON.stringify(pending))
  }

  private clearPending() {
    removeStorage(this.options.storageKey)
  }

  private discardPending(state: RestoredState): RestoredState {
    this.clearPending()
    removeStorage(this.baseKey)
    return state
  }
}
