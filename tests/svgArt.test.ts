import { beforeAll, describe, expect, it, vi } from 'vitest'
import { prepareSvgArt } from '../layers/coloring/server/utils/svgArt'
import { MAX_SVG_BYTES } from '../layers/coloring/shared/gallery'

beforeAll(() => {
  vi.stubGlobal('createError', (input: { statusCode: number, message: string }) => Object.assign(new Error(input.message), input))
})

function rejection(source: string): { statusCode?: number, message: string } {
  try {
    prepareSvgArt(source)
  } catch (error) {
    return error as { statusCode?: number, message: string }
  }
  throw new Error('SVG принят, а должен быть отклонён')
}

function shapes(svg: string): { fill: string, stroke: string }[] {
  return [...svg.matchAll(/<(?:path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*)>/g)].map(([, attributes]) => ({
    fill: /\bfill="([^"]*)"/.exec(attributes!)?.[1] ?? '#000',
    stroke: /\bstroke="([^"]*)"/.exec(attributes!)?.[1] ?? 'none'
  }))
}

const AREA = { fill: '#fff', stroke: '#000' }
const INK = { fill: '#000', stroke: 'none' }

describe('импорт SVG: безопасность', () => {
  const hostile = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" onload="alert(1)">
    <script>alert(1)</script>
    <style>@import url(https://evil.example/x.css);</style>
    <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>
    <a href="javascript:alert(1)"><rect x="5" y="5" width="20" height="20" fill="#f80"/></a>
    <image href="https://evil.example/x.png" width="10" height="10"/>
    <use xlink:href="https://evil.example/s.svg#a"/>
    <rect x="40" y="40" width="40" height="40" fill="url(https://evil.example/p.svg#g)" onclick="alert(2)"/>
  </svg>`

  it('скрипты, обработчики, ссылки и внешние ресурсы вырезаются, фигуры остаются', () => {
    const { svg, notes } = prepareSvgArt(hostile)
    for (const banned of ['script', 'onload', 'onclick', 'javascript:', 'evil.example', 'foreignObject', '<style', '<a', '<image', '<use', 'href']) {
      expect(svg).not.toContain(banned)
    }
    expect(shapes(svg)).toHaveLength(1)
    expect(notes).toHaveLength(1)
  })

  it('DOCTYPE с сущностями отклоняется до разбора', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaaaaaa"><!ENTITY b "&a;&a;&a;">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>&b;</text></svg>'
    const error = rejection(bomb)
    expect(error.statusCode).toBe(422)
    expect(error.message).toMatch(/DOCTYPE/)
  })

  it('слишком большой файл отклоняется до разбора', () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${' '.repeat(MAX_SVG_BYTES)}</svg>`
    expect(rejection(big).statusCode).toBe(422)
  })

  it.each([
    ['не SVG', 'просто текст', /не SVG/],
    ['битая разметка', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect', /не SVG/],
    ['два корня', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/><svg/>', /не SVG/],
    ['без размера', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="5" height="5" fill="#f00"/></svg>', /размер/],
    ['слишком вытянутый', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 100"><rect width="5" height="5" fill="#f00"/></svg>', /вытянутый/],
    ['нет фигур', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>', /нет фигур/],
    ['только текст', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>Привет</text></svg>', /только текст/]
  ])('понятная ошибка 422: %s', (_, source, message) => {
    const error = rejection(source)
    expect(error.statusCode).toBe(422)
    expect(error.message).toMatch(message)
  })
})

describe('импорт SVG: подготовка к раскраске', () => {
  it('длинная сторона — 1024, пропорции сохраняются', () => {
    const wide = prepareSvgArt('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><circle cx="50" cy="50" r="40" fill="#f80"/></svg>')
    expect([wide.width, wide.height]).toEqual([1024, 512])
    const tall = prepareSvgArt('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="400"><circle cx="50" cy="50" r="40" fill="#f80"/></svg>')
    expect([tall.width, tall.height]).toEqual([256, 1024])
  })

  it('цветные фигуры — белые области с чёрной обводкой, тёмная заливка остаётся линией', () => {
    const { svg } = prepareSvgArt(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
      <circle cx="50" cy="50" r="40" fill="#3a7"/>
      <circle cx="150" cy="50" r="40" fill="#111"/>
    </svg>`)
    expect(shapes(svg)).toEqual([AREA, INK])
    expect(svg).not.toContain('#3a7')
  })

  it('фон фрейма Figma не становится областью', () => {
    const { svg } = prepareSvgArt(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="white"/>
      <circle cx="50" cy="50" r="20" fill="#f80"/>
    </svg>`)
    expect(shapes(svg)).toEqual([AREA])
  })

  it('слишком тонкая линия утолщается — иначе краска перетечёт через неё', () => {
    const { svg } = prepareSvgArt('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><path d="M10 10L500 10" stroke="#000" stroke-width="0.2" fill="none"/></svg>')
    expect(svg).toContain('stroke-width="3"')
  })

  it('трассированная картинка (серые заливки без обводок) становится чёрно-белой без новых рамок', () => {
    const { svg } = prepareSvgArt(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <path d="M0 0h100v100H0z" fill="#fefefe"/>
      <path d="M10 10h80v80H10z" fill="#222"/>
      <path d="M20 20h60v60H20z" fill="#eee"/>
    </svg>`)
    expect(shapes(svg)).toEqual([{ fill: '#fff', stroke: 'none' }, INK, { fill: '#fff', stroke: 'none' }])
  })

  it('одинаковый рисунок с другим форматированием даёт тот же результат (основа защиты от повторов)', () => {
    const a = prepareSvgArt('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#f80"/></svg>')
    const b = prepareSvgArt(`<?xml version="1.0"?>
      <svg   viewBox="0 0 100 100"   xmlns="http://www.w3.org/2000/svg">
        <!-- экспорт из редактора -->
        <circle r="40" cy="50" cx="50" fill="#ff8800"/>
      </svg>`)
    expect(a.svg).toBe(b.svg)
  })
})
