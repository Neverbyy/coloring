export function isProtectedAdminPath(path: string): boolean {
  const raw = path.split('?')[0] ?? ''
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {}
  const normalized = new URL(decoded.replace(/\\/g, '/').replace(/\/{2,}/g, '/'), 'http://local').pathname.toLowerCase()
  return normalized.startsWith('/api/admin') && !normalized.startsWith('/api/admin/auth/')
}
