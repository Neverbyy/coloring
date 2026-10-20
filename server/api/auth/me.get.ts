// Гость — не ошибка: отвечаем null, чтобы не засорять консоль ответами 401
export default defineEventHandler((event): Promise<SessionUser | null> => getSessionUser(event))
