import type { H3Event } from 'h3'

export const IMMUTABLE_CACHE = 'private, max-age=31536000, immutable'

const FORMATS = {
  png: { signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), type: 'image/png' },
  jpeg: { signature: Buffer.from([0xff, 0xd8, 0xff]), type: 'image/jpeg' }
}

type ImageFormat = keyof typeof FORMATS

export async function readLimitedBody(event: H3Event, maxBytes: number, tooBigMessage: string, statusCode = 413): Promise<Buffer | null> {
  const tooBig = () => createError({ statusCode, message: tooBigMessage })
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > maxBytes) throw tooBig()
  const body = await readRawBody(event, false)
  if (body && body.length > maxBytes) throw tooBig()
  return body?.length ? body : null
}

export async function readImageBody(event: H3Event, format: ImageFormat, maxBytes: number): Promise<Buffer> {
  const message = `Нужна картинка ${format.toUpperCase()} до ${Math.round(maxBytes / 1024)} КБ`
  const image = await readLimitedBody(event, maxBytes, message, 400)
  const { signature } = FORMATS[format]
  if (!image || !image.subarray(0, signature.length).equals(signature)) {
    throw createError({ statusCode: 400, message })
  }
  return image
}

export function sendImage(event: H3Event, image: Buffer | string | null, format: ImageFormat | 'svg', cacheControl: string) {
  if (!image) throw createError({ statusCode: 404, message: 'Картинки нет' })
  setResponseHeaders(event, format === 'svg'
    ? {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-security-policy': 'default-src \'none\'; style-src \'unsafe-inline\'',
        'x-content-type-options': 'nosniff',
        'cache-control': cacheControl
      }
    : { 'content-type': FORMATS[format].type, 'cache-control': cacheControl })
  return image
}
