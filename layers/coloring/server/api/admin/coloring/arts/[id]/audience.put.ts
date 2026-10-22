import { eq, inArray } from 'drizzle-orm'
import { users } from '~~/server/db/schema'
import type { AdminArtDetails } from '#layers/coloring/shared/admin'
import { coloringArtCountries, coloringArtUsers, coloringArts } from '#layers/coloring/server/db/schema'

const MAX_PLAYERS = 1000

export default defineAdminHandler(async (event): Promise<AdminArtDetails> => {
  const id = artIdParam(event)
  await requireAdminArt(id)
  const body = await readBody<Record<string, unknown> | null>(event)
  const audience = body?.audience
  const countries = body?.countries
  const userIds = body?.userIds
  if (audience !== 'all' && audience !== 'assigned') {
    throw createError({ statusCode: 400, message: 'Неверный выбор «Кому показывать»' })
  }
  if (!Array.isArray(countries) || !countries.every(isCountryCode)
    || !Array.isArray(userIds) || !userIds.every(isUuid) || userIds.length > MAX_PLAYERS) {
    throw createError({ statusCode: 400, message: 'Неверный список стран или игроков' })
  }

  await useDb().transaction(async (tx) => {
    await tx.update(coloringArts).set({ audience }).where(eq(coloringArts.id, id))
    await tx.delete(coloringArtCountries).where(eq(coloringArtCountries.artId, id))
    await tx.delete(coloringArtUsers).where(eq(coloringArtUsers.artId, id))
    const uniqueCountries = [...new Set(countries)]
    if (uniqueCountries.length > 0) {
      await tx.insert(coloringArtCountries).values(uniqueCountries.map(country => ({ artId: id, country })))
    }
    const players = userIds.length > 0
      ? await tx.select({ id: users.id }).from(users).where(inArray(users.id, [...new Set(userIds)]))
      : []
    if (players.length > 0) {
      await tx.insert(coloringArtUsers).values(players.map(player => ({ artId: id, userId: player.id })))
    }
  })
  return getAdminArt(id)
})
