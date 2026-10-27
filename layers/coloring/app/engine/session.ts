import type { DrawingState, HistoryOp } from '#layers/coloring/shared/history'
import { ColoringEngine, type StickerImages } from './engine'
import { ColoringHistory } from './history'
import type { SegmentMap } from './segmentation'
import { HistorySync, type SyncStatus } from './sync'

export interface DrawingSessionOptions {
  artId: string
  storageKey: string
  map: SegmentMap
  paintCanvas: HTMLCanvasElement
  previewCanvas: HTMLCanvasElement
  stickerCanvas: HTMLCanvasElement
  stickerImages: StickerImages
  onChange: (byPlayer: boolean) => void
  onStatus: (status: SyncStatus) => void
  onUnauthorized: () => void
}

export class DrawingSession {
  readonly engine: ColoringEngine
  readonly history: ColoringHistory
  private readonly sync: HistorySync

  constructor(private readonly options: DrawingSessionOptions) {
    const { map, stickerImages } = options
    const engine = new ColoringEngine(
      map,
      { paint: options.paintCanvas, preview: options.previewCanvas, stickers: options.stickerCanvas },
      stickerImages
    )
    const history = new ColoringHistory(engine, {
      createScratch: () => ColoringEngine.offscreen(map, stickerImages),
      onBase: (_seq, base) => this.sync.baked(base)
    })
    this.engine = engine
    this.history = history
    this.sync = new HistorySync({
      artId: options.artId,
      storageKey: options.storageKey,
      source: {
        baseSeq: () => history.baseSeq,
        baseImage: () => history.baseImage,
        ops: () => history.ops,
        cursor: () => history.cursor,
        progress: () => engine.progress()
      },
      onStatus: options.onStatus,
      onUnauthorized: options.onUnauthorized
    })
  }

  get progress(): number {
    return this.engine.progress()
  }

  get canUndo(): boolean {
    return this.history.canUndo
  }

  get canRedo(): boolean {
    return this.history.canRedo
  }

  async load(state: DrawingState, base: Blob | null) {
    this.history.load(await this.sync.restore(state, base))
    await this.history.renderAt(this.history.cursor)
    this.options.onChange(false)
  }

  commit(op: HistoryOp) {
    const truncatedTo = this.history.canRedo ? this.history.cursor : undefined
    this.history.push(op)
    this.sync.changed(truncatedTo)
    this.options.onChange(true)
  }

  async undo() {
    if (!this.history.canUndo) return
    await this.history.undo()
    this.sync.changed()
    this.options.onChange(true)
  }

  redo() {
    if (!this.history.canRedo) return
    this.history.redo()
    this.sync.changed()
    this.options.onChange(true)
  }

  queueThumbnail(image: Blob) {
    this.sync.queueThumbnail(image)
  }

  dispose(lastThumbnail?: Promise<Blob | null>) {
    this.sync.dispose(lastThumbnail)
  }
}
