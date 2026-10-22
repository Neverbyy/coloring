import { and, isNotNull, isNull } from 'drizzle-orm'
import { STATS_PERIODS, type ColoringStats, type StatsPeriod } from '../../../../shared/admin'
import { coloringArts } from '../../../db/schema'

const DAY_MS = 24 * 60 * 60 * 1000

function isPeriod(value: unknown): value is StatsPeriod {
  return STATS_PERIODS.includes(value as StatsPeriod)
}

export default defineAdminHandler(async (event): Promise<ColoringStats> => {
  const query = getQuery(event)
  const period = isPeriod(query.period) ? query.period : 'all'
  const filter = {
    since: period === 'all' ? null : new Date(Date.now() - Number(period) * DAY_MS),
    country: isCountryCode(query.country) ? query.country : null
  }

  const [arts, counts, openers] = await Promise.all([
    useDb()
      .select({
        id: coloringArts.id,
        title: coloringArts.title,
        imageUrl: coloringArts.imageUrl,
        published: coloringArts.published,
        publishedAt: coloringArts.publishedAt,
        hasSvg: hasSvgField
      })
      .from(coloringArts)
      .where(and(isNull(coloringArts.ownerId), isNotNull(coloringArts.publishedAt))),
    countsByArt(filter),
    countOpeners(filter)
  ])

  const items = arts
    .map(art => ({
      id: art.id,
      title: art.title,
      image: adminArtImage(art),
      status: artStatus(art.published, art.publishedAt),
      ...(counts.get(art.id) ?? EMPTY_COUNTS)
    }))
    .sort((a, b) => b.openers - a.openers || b.started - a.started || a.title.localeCompare(b.title, 'ru'))

  return {
    totals: {
      openers,
      started: items.reduce((sum, item) => sum + item.started, 0),
      completed: items.reduce((sum, item) => sum + item.completed, 0)
    },
    items
  }
})
