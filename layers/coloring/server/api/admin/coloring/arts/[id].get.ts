import type { AdminArtDetails } from '../../../../../shared/admin'

export default defineAdminHandler((event): Promise<AdminArtDetails> => getAdminArt(artIdParam(event)))
