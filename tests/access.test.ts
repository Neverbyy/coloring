import { describe, expect, it } from 'vitest'
import { isProtectedAdminPath } from '../server/utils/adminPath'
import { hashPassword, verifyPassword } from '../server/utils/password'
import { HOME_PATH, safeAdminRedirect, safeRedirect } from '../app/utils/safeRedirect'

describe('закрытые пути API админки', () => {
  it.each([
    '/api/admin/users',
    '/api/admin/coloring/arts?status=draft',
    '/api/ADMIN/users',
    '/api/%61dmin/users',
    '//api/admin/users',
    '/api/x/../admin/users',
    '/api\\admin/users',
    '/api/admin/auth/../users'
  ])('%s требует админа', (path) => {
    expect(isProtectedAdminPath(path)).toBe(true)
  })

  it.each([
    '/api/admin/auth/login',
    '/api/admin/auth/me',
    '/api/coloring/arts',
    '/api/auth/login',
    '/admin/users'
  ])('%s открыт без админа', (path) => {
    expect(isProtectedAdminPath(path)).toBe(false)
  })

  it('битая кодировка не обходит проверку', () => {
    expect(isProtectedAdminPath('/api/admin/%E0%A4%A')).toBe(true)
  })
})

describe('пароль админа', () => {
  it('верный пароль проходит, неверный — нет', async () => {
    const stored = await hashPassword('Секрет-123')
    expect(await verifyPassword('Секрет-123', stored)).toBe(true)
    expect(await verifyPassword('секрет-123', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('у каждого хеша своя соль, пароль в нём не хранится', async () => {
    const first = await hashPassword('одинаковый')
    const second = await hashPassword('одинаковый')
    expect(first).not.toBe(second)
    expect(first).not.toContain('одинаковый')
    expect(first.startsWith('scrypt$')).toBe(true)
  })

  it('испорченный хеш не пускает и не падает', async () => {
    expect(await verifyPassword('x', 'plain-text')).toBe(false)
    expect(await verifyPassword('x', 'scrypt$16384$8$1$')).toBe(false)
  })
})

describe('редирект после входа', () => {
  it.each([
    ['/coloring/cat', '/coloring/cat'],
    ['//evil.example', HOME_PATH],
    ['/\\evil.example', HOME_PATH],
    ['https://evil.example', HOME_PATH],
    ['javascript:alert(1)', HOME_PATH],
    [undefined, HOME_PATH],
    [['/coloring'], HOME_PATH]
  ])('игрок: %s → %s', (value, expected) => {
    expect(safeRedirect(value)).toBe(expected)
  })

  it.each([
    ['/admin/users', '/admin/users'],
    ['/admin', '/admin'],
    ['/coloring', '/admin'],
    ['/administrator', '/admin'],
    ['//evil.example/admin', '/admin']
  ])('админ: %s → %s', (value, expected) => {
    expect(safeAdminRedirect(value)).toBe(expected)
  })
})
