import { errorStatus } from '~/utils/httpError'
import { artApiPath } from '../../shared/gallery'
import type { DrawingState, HistoryConflict, HistoryOp, HistorySave } from '../../shared/history'
import { readStorage, removeStorage, writeStorage } from '~/utils/storage'

// Ключ localStorage неотправленного рисунка (свой у каждого игрока).
// v3 — координаты бумаги с полями, в хранилище только неотправленный хвост; база — ключом `…:base`
export function pendingStorageKey(userId: string, artId: string): string {
  return `coloring:v3:${userId}:${artId}`
}

// Забыть неотправленное (арт удалён)
export function forgetPending(storageKey: string) {
  removeStorage(storageKey)
  removeStorage(`${storageKey}:base`)
}

// saved — всё на сервере, saving — отправляем, offline — сервер недоступен, повторим позже
export type SyncStatus = 'saved' | 'saving' | 'offline'

export interface SyncSource {
  baseSeq: () => number
  baseImage: () => Blob | null
  // Операции после базы
  ops: () => HistoryOp[]
  cursor: () => number
  progress: () => number
}

export interface SyncOptions {
  artId: string
  // Ключ localStorage для несохранённого состояния (свой у каждого игрока)
  storageKey: string
  source: SyncSource
  onStatus: (status: SyncStatus) => void
  // Сессия закончилась — сохранять некуда
  onUnauthorized: () => void
}

export interface RestoredState {
  baseSeq: number
  baseImage: Blob | null
  ops: HistoryOp[]
  cursor: number
  progress: number
}

// Несохранённое в localStorage — только то, чего нет на сервере (обычно 0–3 операции):
// пишется на каждое действие, поэтому должно быть маленьким
interface PendingState {
  baseSeq: number
  // Новая база ещё не на сервере; её картинка — в отдельном ключе (пишется один раз)
  baseUnsent: boolean
  // Операции до этого места сервер знает (не меньше baseSeq)
  fromSeq: number
  // Операции после fromSeq
  ops: HistoryOp[]
  cursor: number
  progress: number
  savedAt: number
}

// Пауза перед отправкой: серия быстрых штрихов уходит одним запросом
const DEBOUNCE_MS = 700
const RETRY_MIN_MS = 2000
const RETRY_MAX_MS = 30_000

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

// Автосохранение рисунка. Сервер хранит базовое изображение и операции после него;
// клиент отправляет изменения после последнего подтверждённого места (syncedPrefix).
// Пока ответа нет, состояние лежит в localStorage — закрытая вкладка или обрыв сети
// не теряют работу
export class HistorySync {
  // Сквозной номер: первые syncedPrefix операций на клиенте и сервере совпадают
  private syncedPrefix = 0
  private syncedCursor = 0
  private syncedProgress = 0
  // Новое базовое изображение ещё не на сервере
  private baseUnsent = false
  // Картинка неотправленной базы уже в localStorage
  private baseStored = false
  private thumbnail: Blob | null = null
  // Отмена ниже отправляемого, случившаяся во время запроса: ответ сервера её не перекроет
  private truncatedDuringSend: number | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private retryDelay = RETRY_MIN_MS
  private running = false
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

  // Состояние с сервера + несохранённое из прошлого визита (оно новее — побеждает)
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

    // База: своя неотправленная из localStorage или та же, что на сервере
    let baseImage: Blob | null = null
    if (pending.baseUnsent) {
      const stored = readStorage(this.baseKey)
      if (pending.baseSeq > 0 && !stored) return this.discardPending(fromServer)
      baseImage = stored ? await dataUrlToBlob(stored) : null
    } else if (pending.baseSeq === server.baseSeq) {
      baseImage = serverBase
    } else {
      // База на сервере сменилась (другое устройство), а своей картинки базы нет — берём сервер
      return this.discardPending(fromServer)
    }

    // Операции между базой и fromSeq сервер знает — берём у него, хвост — свой
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

  // Изменилась история или курсор
  changed(truncatedTo?: number) {
    if (truncatedTo !== undefined) {
      this.syncedPrefix = Math.min(this.syncedPrefix, truncatedTo)
      this.truncatedDuringSend = Math.min(this.truncatedDuringSend ?? truncatedTo, truncatedTo)
    }
    this.writePending()
    this.schedule(DEBOUNCE_MS)
  }

  // Старые операции «запечены» в новое базовое изображение
  baked(image: Blob) {
    this.baseUnsent = true
    this.baseStored = false
    // Картинка базы — в localStorage один раз (отдельным ключом); до этого там остаётся
    // прежнее состояние, оно тоже полное
    blobToDataUrl(image).then((url) => {
      if (this.options.source.baseImage() !== image || !this.baseUnsent) return
      // Не поместилось — база уйдёт только на сервер
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

  // Уход со страницы: последняя попытка отправить; не дошло — останется в localStorage
  dispose(lastThumbnail?: Promise<Blob | null>) {
    this.disposed = true
    clearTimeout(this.timer)
    window.removeEventListener('online', this.onOnline)
    document.removeEventListener('visibilitychange', this.onHidden)
    if (!this.baseUnsent && this.dirty) this.sendHistory(true).catch(() => {})
    const thumbnail = lastThumbnail ?? Promise.resolve(this.thumbnail)
    thumbnail.then((image) => {
      if (image) return this.sendThumbnail(image, true)
    }).catch(() => {})
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

  private async run() {
    if (this.running || this.disposed) return
    this.running = true
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
    } finally {
      this.running = false
    }
  }

  private handleError(error: unknown) {
    const status = errorStatus(error)
    if (status === 401) {
      this.options.onUnauthorized()
      return
    }
    if (status === 409 || status === 413) {
      // Сервер опирается на другую базу или не знает нужных операций — выравниваем
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
    // Операции сервера после базы сохранились — подтверждённое место не ниже базы и не выше head
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
    await $fetch(this.url('/history'), { method: 'POST', body: save, keepalive })

    // Пока шёл запрос, игрок мог отменить действия ниже отправленного — тогда не сдвигаемся выше
    this.syncedPrefix = Math.min(fromSeq + save.ops.length, this.truncatedDuringSend ?? Number.POSITIVE_INFINITY)
    this.truncatedDuringSend = null
    this.syncedCursor = save.cursor
    this.syncedProgress = save.progress
    if (this.dirty || this.baseUnsent) this.writePending()
    else this.clearPending()
  }

  private sendThumbnail(image: Blob, keepalive = false) {
    return $fetch(this.url('/thumbnail'), {
      method: 'PUT',
      body: image,
      headers: { 'content-type': 'image/jpeg' },
      keepalive
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
    // Неотправленную базу без её картинки восстановить нельзя — ждём, пока baked её сохранит
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
