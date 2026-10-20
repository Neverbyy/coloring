import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

// Общие таблицы платформы. RLS включён без политик — REST API Supabase к ним доступа не имеет

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Как ввёл пользователь — для показа
  username: text('username').notNull(),
  // Нормализованное имя: уникальность без учёта регистра
  usernameKey: text('username_key').notNull().unique(),
  country: text('country').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}).enableRLS()

export const sessions = pgTable('sessions', {
  // SHA-256 токена из cookie: утечка таблицы не даёт войти под чужой сессией
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull()
}, table => [
  index('sessions_user_idx').on(table.userId)
]).enableRLS()

export type UserRow = typeof users.$inferSelect
