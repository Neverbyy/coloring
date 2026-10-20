import { and, eq, sql } from 'drizzle-orm'
import { coloringDrawings } from '../db/schema'
import { MAX_STORED_OPS, type DrawingState, type HistoryConflict, type HistorySave } from '../../shared/history'

function drawingOf(userId: string, artId: string) {
  return and(eq(coloringDrawings.userId, userId), eq(coloringDrawings.artId, artId))
}

export async function loadDrawing(userId: string, artId: string): Promise<DrawingState> {
  const [row] = await useDb()
    .select({
      baseSeq: coloringDrawings.baseSeq,
      // Только признак: саму картинку база отдаёт отдельным запросом
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

// Операции после fromSeq заменяются присланными (после отмены и нового действия «хвост» отбрасывается).
// Повтор того же запроса даёт тот же результат — клиент может спокойно повторять при сбоях сети
export async function saveDrawingHistory(userId: string, artId: string, save: HistorySave): Promise<{ head: number }> {
  const where = drawingOf(userId, artId)

  return useDb().transaction(async (tx) => {
    await tx.insert(coloringDrawings).values({ userId, artId }).onConflictDoNothing()
    const [row] = await tx
      .select({
        baseSeq: coloringDrawings.baseSeq,
        ops: coloringDrawings.ops,
        startedAt: coloringDrawings.startedAt,
        completedAt: coloringDrawings.completedAt
      })
      .from(coloringDrawings)
      .where(where)
      .for('update')
    if (!row) throw createError({ statusCode: 500, message: 'Не удалось сохранить рисунок' })

    // Клиент опирается на операции, которых у сервера нет (или они уже в базе) —
    // он пришлёт базовое изображение и повторит
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

// Новое базовое изображение: всё до seq теперь в нём. Операции сервера после seq сохраняются —
// их перезапишет следующее сохранение истории. image = null — база пустая (seq = 0)
export async function saveDrawingBase(userId: string, artId: string, seq: number, image: Buffer | null): Promise<{ head: number }> {
  const where = drawingOf(userId, artId)

  return useDb().transaction(async (tx) => {
    await tx.insert(coloringDrawings).values({ userId, artId }).onConflictDoNothing()
    const [row] = await tx
      .select({ baseSeq: coloringDrawings.baseSeq, ops: coloringDrawings.ops, cursor: coloringDrawings.cursor })
      .from(coloringDrawings)
      .where(where)
      .for('update')
    if (!row) throw createError({ statusCode: 500, message: 'Не удалось сохранить рисунок' })

    const head = row.baseSeq + row.ops.length
    // Если сервер знает операции после seq — оставляем их, иначе журнал начинается с базы
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

// Картинки рисунка: базовое изображение (PNG) или миниатюра для галереи (JPEG)
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
