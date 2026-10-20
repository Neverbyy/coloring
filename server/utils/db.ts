import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

let db: PostgresJsDatabase | undefined

// Одно подключение на экземпляр сервера (на Vercel — на «тёплую» функцию)
export function useDb(): PostgresJsDatabase {
  if (db) return db

  const { databaseUrl } = useRuntimeConfig()
  if (!databaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'База данных не настроена (NUXT_DATABASE_URL)' })
  }

  // Transaction pooler Supabase не поддерживает prepared statements
  const client = postgres(databaseUrl, { prepare: false, max: 5, idle_timeout: 20 })
  db = drizzle(client)
  return db
}
