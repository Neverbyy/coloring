import type { H3Event } from 'h3'

const FORMATS = {
  png: { signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), type: 'image/png' },
  jpeg: { signature: Buffer.from([0xff, 0xd8, 0xff]), type: 'image/jpeg' }
}

type ImageFormat = keyof typeof FORMATS

// Картинка из тела запроса: формат проверяется по сигнатуре файла, а не по заголовку
export async function readImageBody(event: H3Event, format: ImageFormat, maxBytes: number): Promise<Buffer> {
  const image = await readRawBody(event, false)
  const { signature } = FORMATS[format]
  if (!image || image.length > maxBytes || !image.subarray(0, signature.length).equals(signature)) {
    throw createError({ statusCode: 400, message: `Нужна картинка ${format.toUpperCase()} до ${Math.round(maxBytes / 1024)} КБ` })
  }
  return image
}

// Отдать картинку из БД; нет — 404
export function sendImage(event: H3Event, image: Buffer | null, format: ImageFormat, cacheControl: string): Buffer {
  if (!image) throw createError({ statusCode: 404, message: 'Картинки нет' })
  setResponseHeaders(event, { 'content-type': FORMATS[format].type, 'cache-control': cacheControl })
  return image
}
