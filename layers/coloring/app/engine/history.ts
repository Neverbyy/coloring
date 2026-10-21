import { BAKE_CHUNK, HISTORY_LIMIT, SNAPSHOT_INTERVAL, type HistoryOp } from '../../shared/history'
import type { ColoringEngine } from './engine'

export interface HistoryState {
  baseSeq: number
  // PNG краски после baseSeq операций; null — чистый холст
  baseImage: Blob | null
  ops: HistoryOp[]
  cursor: number
}

export interface HistoryOptions {
  // Невидимый движок: на нём собирается новое базовое изображение, экран не трогается
  createScratch: () => ColoringEngine
  // Старые операции «запечены» в новое базовое изображение — отправить на сервер
  onBase: (seq: number, image: Blob) => void
}

// Журнал операций с курсором (undo/redo). Номера операций сквозные:
// ops[i] — операция baseSeq + i + 1, курсор — сквозной номер последней применённой.
// Отменить можно не меньше HISTORY_LIMIT действий: когда операций становится
// HISTORY_LIMIT + BAKE_CHUNK, самые старые BAKE_CHUNK «запекаются» в базовое изображение.
// Для быстрой отмены в памяти держатся снимки холста — не реже чем через SNAPSHOT_INTERVAL операций
export class ColoringHistory {
  baseSeq = 0
  baseImage: Blob | null = null
  ops: HistoryOp[] = []
  cursor = 0
  // Снимки краски в памяти (PNG — компактнее растра): сквозной номер → картинка
  private readonly snapshots = new Map<number, Blob>()
  // Растёт при отбрасывании отменённых действий: запоздавший снимок старой ветки не нужен
  private generation = 0
  private baking = false
  // Самая низкая точка отбрасывания с начала «запекания»
  private truncatedTo = Number.POSITIVE_INFINITY

  constructor(
    private readonly engine: ColoringEngine,
    private readonly options: HistoryOptions
  ) {}

  get head(): number {
    return this.baseSeq + this.ops.length
  }

  get canUndo(): boolean {
    return this.cursor > this.baseSeq
  }

  get canRedo(): boolean {
    return this.cursor < this.head
  }

  load(state: HistoryState) {
    this.baseSeq = state.baseSeq
    this.baseImage = state.baseImage
    this.ops = state.ops.slice()
    this.cursor = Math.min(Math.max(state.cursor, this.baseSeq), this.head)
    this.snapshots.clear()
    this.generation++
  }

  // Нарисовать состояние на позиции target
  async renderAt(target: number) {
    const from = await this.restoreNearest(this.engine, target)
    // Заполнение — один раз в конце, а не после каждой операции
    for (let seq = from; seq < target; seq++) this.engine.apply(this.ops[seq - this.baseSeq]!, false)
    this.engine.measureAll()
    this.cursor = target
    if (target - from >= SNAPSHOT_INTERVAL) this.takeSnapshot()
  }

  // Новое действие (уже нарисовано на холсте). Отменённые действия после курсора отбрасываются
  push(op: HistoryOp) {
    if (this.canRedo) this.truncate(this.cursor)
    this.ops.push(op)
    this.cursor = this.head
    if (this.cursor - this.latestSnapshot(this.cursor) >= SNAPSHOT_INTERVAL) this.takeSnapshot()
    if (this.ops.length >= HISTORY_LIMIT + BAKE_CHUNK) this.bake()
  }

  async undo() {
    if (this.canUndo) await this.renderAt(this.cursor - 1)
  }

  // Повтор — просто выполнить следующую операцию, без перерисовки
  redo() {
    if (!this.canRedo) return
    this.engine.apply(this.ops[this.cursor - this.baseSeq]!)
    this.cursor++
  }

  private truncate(seq: number) {
    this.ops.length = seq - this.baseSeq
    this.generation++
    this.truncatedTo = Math.min(this.truncatedTo, seq)
    this.dropSnapshots(key => key > seq)
  }

  // Восстановить на движке ближайшее сохранённое состояние не новее target; вернуть его номер
  private async restoreNearest(engine: ColoringEngine, target: number): Promise<number> {
    const candidates = [...this.snapshots.keys()].filter(seq => seq >= this.baseSeq && seq <= target).sort((a, b) => b - a)
    for (const seq of candidates) {
      if (await this.restoreImage(engine, this.snapshots.get(seq)!)) return seq
      this.snapshots.delete(seq)
    }
    if (this.baseImage && await this.restoreImage(engine, this.baseImage)) return this.baseSeq
    engine.reset()
    return this.baseSeq
  }

  private async restoreImage(engine: ColoringEngine, image: Blob): Promise<boolean> {
    try {
      const bitmap = await createImageBitmap(image)
      engine.restore(bitmap)
      bitmap.close()
      return true
    } catch {
      return false
    }
  }

  private dropSnapshots(drop: (seq: number) => boolean) {
    for (const seq of [...this.snapshots.keys()]) if (drop(seq)) this.snapshots.delete(seq)
  }

  private latestSnapshot(limit: number): number {
    let latest = this.baseSeq
    for (const seq of this.snapshots.keys()) if (seq <= limit && seq > latest) latest = seq
    return latest
  }

  private takeSnapshot() {
    const seq = this.cursor
    const generation = this.generation
    this.engine.snapshot().then((image) => {
      if (generation === this.generation && seq <= this.head) this.snapshots.set(seq, image)
    }).catch(() => {
      // Снимок — только ускорение: без него состояние доиграется из более раннего
    })
  }

  // Самые старые BAKE_CHUNK операций — в базовое изображение. Собирается на невидимом движке,
  // в фоне: игрок продолжает рисовать
  private async bake() {
    if (this.baking) return
    this.baking = true
    this.truncatedTo = Number.POSITIVE_INFINITY
    const seq = this.baseSeq + BAKE_CHUNK
    try {
      // Обычно снимок ровно на этом месте уже есть в памяти; иначе собираем на невидимом движке
      let image = this.snapshots.get(seq)
      if (!image) {
        const scratch = this.options.createScratch()
        const from = await this.restoreNearest(scratch, seq)
        for (let i = from; i < seq; i++) scratch.apply(this.ops[i - this.baseSeq]!, false)
        image = await scratch.snapshot()
      }

      // Пока собирали, игрок отменил действия ниже новой базы — эта база уже не подходит
      if (this.truncatedTo < seq || this.cursor < seq) return

      this.ops = this.ops.slice(seq - this.baseSeq)
      this.baseSeq = seq
      this.baseImage = image
      this.dropSnapshots(key => key < seq)
      this.options.onBase(seq, image)
    } catch {
      // Не получилось — попробуем при следующем действии
    } finally {
      this.baking = false
    }
  }
}
