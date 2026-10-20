import { sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core'
import { users } from '../../../../server/db/schema'
import type { HistoryOp } from '../../shared/history'

// Таблицы игры — с префиксом coloring_, чтобы не пересекаться с другими мини-играми.
// RLS включён без политик: REST API Supabase (публичный ключ) к таблицам доступа не имеет,
// сервер подключается ролью postgres и RLS обходит

const bytea = customType<{ data: Buffer }>({
  dataType: () => 'bytea'
})

export const coloringArts = pgTable('coloring_arts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  title: text('title').notNull(),
  imageUrl: text('image_url').notNull(),
  // Размер картинки: пропорции холста известны ещё до её загрузки (SSR без скачков)
  width: integer('width').notNull().default(1024),
  height: integer('height').notNull().default(1024),
  // Порядок в галерее; при равенстве — по дате добавления
  sortOrder: integer('sort_order').notNull().default(0),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('coloring_arts_gallery_idx').on(table.published, table.sortOrder, table.createdAt)
]).enableRLS()

// Рисунок игрока — одна строка на пару «игрок + арт». Базовое изображение (PNG) хранит всё,
// что старше последних операций; ops — последние операции, которые можно отменить.
// Номера операций сквозные: ops[0] имеет номер base_seq + 1
export const coloringDrawings = pgTable('coloring_drawings', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  artId: text('art_id').notNull().references(() => coloringArts.id, { onDelete: 'cascade' }),
  baseSeq: integer('base_seq').notNull().default(0),
  // null — база пустая (чистый холст)
  baseImage: bytea('base_image'),
  ops: jsonb('ops').$type<HistoryOp[]>().notNull().default([]),
  // Позиция undo/redo, сквозной номер: base_seq ≤ cursor ≤ base_seq + длина ops
  cursor: integer('cursor').notNull().default(0),
  progress: real('progress').notNull().default(0),
  // Миниатюра для галереи (JPEG)
  thumbnail: bytea('thumbnail'),
  thumbnailUpdatedAt: timestamp('thumbnail_updated_at', { withTimezone: true }),
  // Для статистики: когда начал раскрашивать и когда впервые довёл до 100%
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  primaryKey({ columns: [table.userId, table.artId] })
]).enableRLS()

export type ColoringArtRow = typeof coloringArts.$inferSelect
