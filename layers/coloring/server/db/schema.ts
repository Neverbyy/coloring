import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Таблицы игры — с префиксом coloring_, чтобы не пересекаться с другими мини-играми.
// RLS включён без политик: REST API Supabase (публичный ключ) к таблицам доступа не имеет,
// сервер подключается ролью postgres и RLS обходит
export const coloringArts = pgTable('coloring_arts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  title: text('title').notNull(),
  imageUrl: text('image_url').notNull(),
  // Порядок в галерее; при равенстве — по дате добавления
  sortOrder: integer('sort_order').notNull().default(0),
  published: boolean('published').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('coloring_arts_gallery_idx').on(table.published, table.sortOrder, table.createdAt)
]).enableRLS()

export type ColoringArtRow = typeof coloringArts.$inferSelect
