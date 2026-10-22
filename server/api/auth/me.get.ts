export default defineEventHandler((event): Promise<SessionUser | null> => getSessionUser(event))
