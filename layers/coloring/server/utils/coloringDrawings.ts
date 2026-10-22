import { and, eq, sql } from 'drizzle-orm'
import { coloringDrawings } from '#layers/coloring/server/db/schema'
import { MAX_STORED_OPS, type DrawingState, type HistoryConflict, type HistorySave } from '#layers/coloring/shared/history'

function drawingOf(userId: string, artId: string) {
  return and(eq(coloringDrawings.userId, userId), eq(coloringDrawings.artId, artId))
}

type DrawingColumns = typeof coloringDrawings.$inferSelect
type Transaction = Parameters<Parameters<ReturnType<typeof useDb>['transaction']>[0]>[0]

async function withLockedDrawing<K extends keyof DrawingColumns, T>(
  userId: string,
  artId: string,
  fields: readonly K[],
  change: (tx: Transaction, row: Pick<DrawingColumns, K>, where: ReturnType<typeof drawingOf>) => Promise<T>
): Promise<T> {
  const where = drawingOf(userId, artId)
  const columns = Object.fromEntries(fields.map(field => [field, coloringDrawings[field]])) as { [P in K]: (typeof coloringDrawings)[P] }
  return useDb().transaction(async (tx) => {
    await tx.insert(coloringDrawings).values({ userId, artId }).onConflictDoNothing()
    const [row] = await tx.select(columns).from(coloringDrawings).where(where).for('update')
    if (!row) throw createError({ statusCode: 500, message: 'Не удалось сохранить рисунок' })
    return change(tx, row as Pick<DrawingColumns, K>, where)
  })
}

export async function loadDrawing(userId: string, artId: string): Promise<DrawingState> {
  const [row] = await useDb()
    .select({
      baseSeq: coloringDrawings.baseSeq,
      hasBase: sql<boolean>`${coloringDrawings.baseImage} is not null`,
      ops: coloringDrawings.ops,
      cursor: coloringDrawings.cursor,
      progress: coloringDrawings.progress
    })
    .from(coloringDrawings)
    .where(drawingOf(userId, artId))
    .limit(1)
  return row ?? { baseSeq: 0, hasBase: false, ops: [], cursor: 0, progress: 0 }
}

export function saveDrawingHistory(userId: string, artId: string, save: HistorySave): Promise<{ head: number }> {
  return withLockedDrawing(userId, artId, ['baseSeq', 'ops', 'startedAt', 'completedAt'], async (tx, row, where) => {
    const head = row.baseSeq + row.ops.length
    if (save.fromSeq < row.baseSeq || save.fromSeq > head) {
      const conflict: HistoryConflict = { baseSeq: row.baseSeq, head }
      throw createError({ statusCode: 409, message: 'История устарела', data: conflict })
    }

    const ops = [...row.ops.slice(0, save.fromSeq - row.baseSeq), ...save.ops]
    if (ops.length > MAX_STORED_OPS) {
      throw createError({ statusCode: 413, message: 'Слишком длинная история' })
    }
    const newHead = row.baseSeq + ops.length
    if (save.cursor < row.baseSeq || save.cursor > newHead) {
      throw createError({ statusCode: 400, message: 'Неверная позиция истории' })
    }

    const now = new Date()
    await tx.update(coloringDrawings).set({
      ops,
      cursor: save.cursor,
      progress: save.progress,
      startedAt: row.startedAt ?? (newHead > 0 ? now : null),
      completedAt: row.completedAt ?? (save.progress >= 100 ? now : null),
      updatedAt: now
    }).where(where)

    return { head: newHead }
  })
}

export function saveDrawingBase(userId: string, artId: string, seq: number, image: Buffer | null): Promise<{ head: number }> {
  return withLockedDrawing(userId, artId, ['baseSeq', 'ops', 'cursor'], async (tx, row, where) => {
    const head = row.baseSeq + row.ops.length
    const ops = seq >= row.baseSeq && seq <= head ? row.ops.slice(seq - row.baseSeq) : []
    const cursor = Math.min(Math.max(row.cursor, seq), seq + ops.length)

    await tx.update(coloringDrawings).set({
      baseSeq: seq,
      baseImage: image,
      ops,
      cursor,
      updatedAt: new Date()
    }).where(where)

    return { head: seq + ops.length }
  })
}

const IMAGE_COLUMNS = {
  base: coloringDrawings.baseImage,
  thumbnail: coloringDrawings.thumbnail
}

export async function loadDrawingImage(userId: string, artId: string, kind: keyof typeof IMAGE_COLUMNS): Promise<Buffer | null> {
  const [row] = await useDb()
    .select({ image: IMAGE_COLUMNS[kind] })
    .from(coloringDrawings)
    .where(drawingOf(userId, artId))
    .limit(1)
  return row?.image ?? null
}

export async function saveDrawingThumbnail(userId: string, artId: string, image: Buffer): Promise<void> {
  const now = new Date()
  await useDb()
    .insert(coloringDrawings)
    .values({ userId, artId, thumbnail: image, thumbnailUpdatedAt: now })
    .onConflictDoUpdate({
      target: [coloringDrawings.userId, coloringDrawings.artId],
      set: { thumbnail: image, thumbnailUpdatedAt: now }
    })
}
