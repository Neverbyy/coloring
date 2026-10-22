import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile()
} catch {
}

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./server/db/schema.ts', './layers/*/server/db/schema.ts'],
  out: './server/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? ''
  }
})
