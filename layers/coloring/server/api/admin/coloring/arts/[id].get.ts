import type { AdminArtDetails } from '#layers/coloring/shared/admin'

export default defineAdminHandler((event): Promise<AdminArtDetails> => getAdminArt(artIdParam(event)))
