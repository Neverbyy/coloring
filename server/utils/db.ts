import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

let db: PostgresJsDatabase | undefined

type ClientOptions = postgres.Options<Record<string, postgres.PostgresType>> & { max_pipeline: number }

export function useDb(): PostgresJsDatabase {
  if (db) return db

  const { databaseUrl } = useRuntimeConfig()
  if (!databaseUrl) {
    throw createError({ statusCode: 500, statusMessage: 'База данных не настроена (NUXT_DATABASE_URL)' })
  }

  const client = postgres(databaseUrl, { prepare: false, max: 5, idle_timeout: 20, max_pipeline: 0 } as ClientOptions)
  const transactions = drizzle(postgres(databaseUrl, { prepare: false, max: 3, idle_timeout: 20, max_pipeline: 1 } as ClientOptions))

  const instance = drizzle(client)
  instance.transaction = transactions.transaction.bind(transactions)
  db = instance
  return db
}
