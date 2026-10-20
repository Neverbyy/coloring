import { MAX_STORED_OPS, parseHistoryOp, type HistoryOp } from '../../../../../shared/history'

export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  const body = await readBody<Record<string, unknown> | null>(event)

  const { fromSeq, cursor, progress } = body ?? {}
  if (!Number.isInteger(fromSeq) || (fromSeq as number) < 0) {
    throw createError({ statusCode: 400, message: 'Неверная позиция истории' })
  }
  if (!Array.isArray(body?.ops) || body.ops.length > MAX_STORED_OPS) {
    throw createError({ statusCode: 400, message: 'Неверный список действий' })
  }
  const ops: HistoryOp[] = []
  for (const value of body.ops) {
    const op = parseHistoryOp(value)
    if (!op) throw createError({ statusCode: 400, message: 'Неверное действие в истории' })
    ops.push(op)
  }
  if (!Number.isInteger(cursor) || (cursor as number) < 0) {
    throw createError({ statusCode: 400, message: 'Неверная позиция истории' })
  }
  if (typeof progress !== 'number' || !Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw createError({ statusCode: 400, message: 'Неверный процент заполнения' })
  }

  return saveDrawingHistory(user.id, artId, {
    fromSeq: fromSeq as number,
    ops,
    cursor: cursor as number,
    progress
  })
})
