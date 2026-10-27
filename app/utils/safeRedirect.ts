export const HOME_PATH = '/'

export function safeRedirect(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return HOME_PATH
  }
  return value
}

export const ADMIN_HOME_PATH = '/admin'
export const ADMIN_LOGIN_PATH = '/admin/login'

export function safeAdminRedirect(value: unknown): string {
  const path = safeRedirect(value)
  return path === ADMIN_HOME_PATH || path.startsWith(`${ADMIN_HOME_PATH}/`) ? path : ADMIN_HOME_PATH
}
