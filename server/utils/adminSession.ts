import { and, eq, gt, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { adminSessions, admins } from '../db/schema'

declare module 'h3' {
  interface H3EventContext {
    sessionAdmin?: SessionAdmin | null
  }
}

const COOKIE_NAME = 'admin_session'
const COOKIE_PATH = '/api/admin'
const LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
const MAX_FAILED_LOGINS = 5
const LOCK_MS = 15 * 60 * 1000
const MAX_USERNAME = 64
const MAX_PASSWORD = 256

const LOGIN_FAILED = 'Неверный логин или пароль'

let dummyHash: Promise<string> | undefined

function setAdminCookie(event: H3Event, token: string, expires: Date) {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires
  })
}

export async function loginAdmin(event: H3Event, username: unknown, password: unknown): Promise<SessionAdmin> {
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password
    || username.length > MAX_USERNAME || password.length > MAX_PASSWORD) {
    throw createError({ statusCode: 400, message: 'Введите логин и пароль' })
  }

  const db = useDb()
  const [row] = await db.select().from(admins).where(eq(admins.username, username.trim().toLowerCase())).limit(1)
  if (!row) {
    dummyHash ??= hashPassword('dummy-password')
    await verifyPassword(password, await dummyHash)
    throw createError({ statusCode: 401, message: LOGIN_FAILED })
  }
  if (row.lockedUntil && row.lockedUntil > new Date()) {
    throw createError({ statusCode: 429, message: 'Слишком много неудачных попыток — попробуйте через 15 минут' })
  }

  if (!(await verifyPassword(password, row.passwordHash))) {
    const [updated] = await db.update(admins)
      .set({ failedLogins: sql`${admins.failedLogins} + 1` })
      .where(eq(admins.id, row.id))
      .returning({ failedLogins: admins.failedLogins })
    if (updated && updated.failedLogins >= MAX_FAILED_LOGINS) {
      await db.update(admins)
        .set({ failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MS) })
        .where(eq(admins.id, row.id))
    }
    throw createError({ statusCode: 401, message: LOGIN_FAILED })
  }

  if (row.failedLogins > 0 || row.lockedUntil) {
    await db.update(admins).set({ failedLogins: 0, lockedUntil: null }).where(eq(admins.id, row.id))
  }

  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + LIFETIME_MS)
  await db.insert(adminSessions).values({ id: hashSessionToken(token), adminId: row.id, expiresAt })
  setAdminCookie(event, token, expiresAt)

  const admin: SessionAdmin = { id: row.id, username: row.username, role: row.role }
  event.context.sessionAdmin = admin
  return admin
}

export async function getSessionAdmin(event: H3Event): Promise<SessionAdmin | null> {
  if (event.context.sessionAdmin !== undefined) return event.context.sessionAdmin

  const token = getCookie(event, COOKIE_NAME)
  let admin: SessionAdmin | null = null

  if (token) {
    const [row] = await useDb()
      .select({ id: admins.id, username: admins.username, role: admins.role })
      .from(adminSessions)
      .innerJoin(admins, eq(admins.id, adminSessions.adminId))
      .where(and(eq(adminSessions.id, hashSessionToken(token)), gt(adminSessions.expiresAt, new Date())))
      .limit(1)
    if (row) admin = row
    else deleteCookie(event, COOKIE_NAME, { path: COOKIE_PATH })
  }

  event.context.sessionAdmin = admin
  return admin
}

export async function requireAdmin(event: H3Event): Promise<SessionAdmin> {
  const admin = await getSessionAdmin(event)
  if (!admin) throw createError({ statusCode: 401, message: 'Войдите в админку' })
  if (admin.role !== 'admin') throw createError({ statusCode: 403, message: 'Нет доступа' })
  return admin
}

export async function destroyAdminSession(event: H3Event): Promise<void> {
  const token = getCookie(event, COOKIE_NAME)
  if (token) await useDb().delete(adminSessions).where(eq(adminSessions.id, hashSessionToken(token)))
  deleteCookie(event, COOKIE_NAME, { path: COOKIE_PATH })
  event.context.sessionAdmin = null
}

export function defineAdminHandler<T>(handler: (event: H3Event, admin: SessionAdmin) => T | Promise<T>) {
  return defineEventHandler(async event => handler(event, await requireAdmin(event)))
}
