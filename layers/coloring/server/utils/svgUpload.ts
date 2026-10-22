import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { IMPORT_MESSAGES, MAX_SVG_BYTES, artApiPath } from '#layers/coloring/shared/gallery'

export interface SvgUpload {
  values: {
    id: string
    title: string
    imageUrl: string
    width: number
    height: number
    svg: string
    svgHash: string
  }
  notes: string[]
}

export async function readSvgUpload(event: H3Event, fallbackTitle: string): Promise<SvgUpload> {
  const body = await readLimitedBody(event, MAX_SVG_BYTES, IMPORT_MESSAGES.tooBig)
  if (!body) throw createError({ statusCode: 400, message: IMPORT_MESSAGES.empty })

  const prepared = prepareSvgArt(new TextDecoder('utf-8', { fatal: false }).decode(body))
  const id = crypto.randomUUID()
  return {
    values: {
      id,
      title: artTitleFromFileName(getQuery(event).name, fallbackTitle),
      imageUrl: artApiPath(id, '/image'),
      width: prepared.width,
      height: prepared.height,
      svg: prepared.svg,
      svgHash: createHash('sha256').update(prepared.svg).digest('hex')
    },
    notes: prepared.notes
  }
}
