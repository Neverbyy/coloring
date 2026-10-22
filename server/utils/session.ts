import { and, eq, gt } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { sessions, users } from '../db/schema'

declare module 'h3' {
  interface H3EventContext {
    sessionUser?: SessionUser | null
  }
}

const COOKIE_NAME = 'session'
const LIFETIME_MS = 180 * 24 * 60 * 60 * 1000

function setSessionCookie(event: H3Event, token: string, expires: Date) {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    expires
  })
}

export async function createSession(event: H3Event, userId: string): Promise<void> {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + LIFETIME_MS)
  await useDb().insert(sessions).values({ id: hashSessionToken(token), userId, expiresAt })
  setSessionCookie(event, token, expiresAt)
}

export async function getSessionUser(event: H3Event): Promise<SessionUser | null> {
  if (event.context.sessionUser !== undefined) return event.context.sessionUser

  const token = getCookie(event, COOKIE_NAME)
  let user: SessionUser | null = null

  if (token) {
    const id = hashSessionToken(token)
    const [row] = await useDb()
      .select({ id: users.id, username: users.username, country: users.country, expiresAt: sessions.expiresAt })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
      .limit(1)

    if (row) {
      user = { id: row.id, username: row.username, country: row.country }
      if (row.expiresAt.getTime() - Date.now() < LIFETIME_MS / 2) {
        const expiresAt = new Date(Date.now() + LIFETIME_MS)
        await useDb().update(sessions).set({ expiresAt }).where(eq(sessions.id, id))
        setSessionCookie(event, token, expiresAt)
      }
    } else {
      deleteCookie(event, COOKIE_NAME, { path: '/' })
    }
  }

  event.context.sessionUser = user
  return user
}

export async function requireUser(event: H3Event): Promise<SessionUser> {
  const user = await getSessionUser(event)
  if (!user) throw createError({ statusCode: 401, message: 'Нужно войти' })
  return user
}

export async function destroySession(event: H3Event): Promise<void> {
  const token = getCookie(event, COOKIE_NAME)
  if (token) await useDb().delete(sessions).where(eq(sessions.id, hashSessionToken(token)))
  deleteCookie(event, COOKIE_NAME, { path: '/' })
  event.context.sessionUser = null
}
