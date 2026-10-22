export default defineEventHandler((event): Promise<SessionAdmin | null> => getSessionAdmin(event))
