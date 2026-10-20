import { defineConfig } from 'drizzle-kit'

// Локально строка берётся из .env; в CI/на сервере — из окружения
try {
  process.loadEnvFile()
} catch {
  // .env нет — используем переменные окружения как есть
}

export default defineConfig({
  dialect: 'postgresql',
  // Общие таблицы платформы — server/db, таблицы игр — в своих слоях
  schema: ['./server/db/schema.ts', './layers/*/server/db/schema.ts'],
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? ''
  }
})
