import { coloringArtOpens } from '#layers/coloring/server/db/schema'

export default defineEventHandler(async (event) => {
  const { user, artId } = await requireDrawingRequest(event)
  await useDb().insert(coloringArtOpens).values({ userId: user.id, artId })
  setResponseStatus(event, 204)
  return null
})
