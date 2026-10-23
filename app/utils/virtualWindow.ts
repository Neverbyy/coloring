export interface VirtualWindow {
  first: number
  last: number
}

export function virtualWindow(scrollTop: number, viewportHeight: number, rowHeight: number, count: number, overscan: number): VirtualWindow {
  if (count <= 0 || rowHeight <= 0) return { first: 0, last: 0 }
  const top = Math.max(0, scrollTop)
  const first = Math.min(count, Math.max(0, Math.floor(top / rowHeight) - overscan))
  const last = Math.min(count, Math.ceil((top + Math.max(0, viewportHeight)) / rowHeight) + overscan)
  return { first, last: Math.max(first, last) }
}

export function scrollTopToReveal(index: number, rowHeight: number, inset: number, scrollTop: number, viewportHeight: number, center = false): number {
  const top = inset + index * rowHeight
  if (center) return Math.max(0, top - viewportHeight / 2 + rowHeight / 2)
  if (top < scrollTop) return top
  if (top + rowHeight > scrollTop + viewportHeight) return top + rowHeight - viewportHeight
  return scrollTop
}
