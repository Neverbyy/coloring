import { IMPORT_MESSAGES, MAX_SVG_BYTES } from '#layers/coloring/shared/gallery'

export function svgFileProblem(file: File): string | null {
  const isSvg = /\.svg$/i.test(file.name) || file.type === 'image/svg+xml'
  if (!isSvg) return IMPORT_MESSAGES.notSvg
  if (file.size === 0) return IMPORT_MESSAGES.empty
  if (file.size > MAX_SVG_BYTES) return IMPORT_MESSAGES.tooBig
  return null
}
