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
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { users } from '../../../../server/db/schema'
import type { HistoryOp } from '../../shared/history'

const bytea = customType<{ data: Buffer }>({
  dataType: () => 'bytea'
})

export const coloringArts = pgTable('coloring_arts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  title: text('title').notNull(),
  imageUrl: text('image_url').notNull(),
  width: integer('width').notNull().default(1024),
  height: integer('height').notNull().default(1024),
  sortOrder: integer('sort_order').notNull().default(0),
  published: boolean('published').notNull().default(true),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  audience: text('audience', { enum: ['all', 'assigned'] }).notNull().default('all'),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }),
  svg: text('svg'),
  svgHash: text('svg_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('coloring_arts_gallery_idx').on(table.published, table.sortOrder, table.createdAt),
  index('coloring_arts_owner_idx').on(table.ownerId, table.createdAt),
  uniqueIndex('coloring_arts_owner_svg_idx').on(table.ownerId, table.svgHash)
]).enableRLS()

export const coloringDrawings = pgTable('coloring_drawings', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  artId: text('art_id').notNull().references(() => coloringArts.id, { onDelete: 'cascade' }),
  baseSeq: integer('base_seq').notNull().default(0),
  baseImage: bytea('base_image'),
  ops: jsonb('ops').$type<HistoryOp[]>().notNull().default([]),
  cursor: integer('cursor').notNull().default(0),
  progress: real('progress').notNull().default(0),
  thumbnail: bytea('thumbnail'),
  thumbnailUpdatedAt: timestamp('thumbnail_updated_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  primaryKey({ columns: [table.userId, table.artId] })
]).enableRLS()

export const coloringArtCountries = pgTable('coloring_art_countries', {
  artId: text('art_id').notNull().references(() => coloringArts.id, { onDelete: 'cascade' }),
  country: text('country').notNull()
}, table => [
  primaryKey({ columns: [table.artId, table.country] })
]).enableRLS()

export const coloringArtUsers = pgTable('coloring_art_users', {
  artId: text('art_id').notNull().references(() => coloringArts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
}, table => [
  primaryKey({ columns: [table.artId, table.userId] }),
  index('coloring_art_users_user_idx').on(table.userId)
]).enableRLS()

export const coloringArtOpens = pgTable('coloring_art_opens', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  artId: text('art_id').notNull().references(() => coloringArts.id, { onDelete: 'cascade' }),
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('coloring_art_opens_art_idx').on(table.artId, table.openedAt),
  index('coloring_art_opens_user_idx').on(table.userId)
]).enableRLS()

export type ColoringArtRow = typeof coloringArts.$inferSelect
