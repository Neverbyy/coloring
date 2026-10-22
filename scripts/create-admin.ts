import { randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { hashPassword } from '../server/utils/password.ts'

const username = process.argv[2]?.trim().toLowerCase()
if (!username || !/^[a-z0-9_.-]{3,64}$/.test(username)) {
  console.error('Укажите логин: npm run admin:create -- <логин> (латиница, цифры, _ . -, от 3 символов)')
  process.exit(1)
}

try {
  process.loadEnvFile()
} catch {}
const url = process.env.DATABASE_MIGRATION_URL || process.env.NUXT_DATABASE_URL
if (!url) {
  console.error('Нет строки подключения: DATABASE_MIGRATION_URL или NUXT_DATABASE_URL')
  process.exit(1)
}

const password = randomBytes(18).toString('base64url')
const sql = postgres(url, { prepare: false, max: 1 })
try {
  const [row] = await sql<{ created: boolean }[]>`
    insert into admins (username, password_hash)
    values (${username}, ${await hashPassword(password)})
    on conflict (username) do update
      set password_hash = excluded.password_hash, failed_logins = 0, locked_until = null
    returning (xmax = 0) as created
  `
  if (!row?.created) await sql`delete from admin_sessions where admin_id = (select id from admins where username = ${username})`
  console.log(row?.created ? 'Администратор создан' : 'Пароль администратора сброшен, его сессии закрыты')
  console.log(`Логин:  ${username}`)
  console.log(`Пароль: ${password}`)
} finally {
  await sql.end()
}
