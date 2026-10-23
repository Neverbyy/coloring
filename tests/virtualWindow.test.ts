import { describe, expect, it } from 'vitest'
import { scrollTopToReveal, virtualWindow } from '../app/utils/virtualWindow'

describe('виртуальный список', () => {
  it('в начале — видимые строки и запас снизу', () => {
    expect(virtualWindow(0, 264, 44, 249, 6)).toEqual({ first: 0, last: 12 })
  })

  it('в середине — запас с обеих сторон', () => {
    expect(virtualWindow(4400, 264, 44, 249, 6)).toEqual({ first: 94, last: 112 })
  })

  it('в конце не выходит за список', () => {
    expect(virtualWindow(249 * 44 - 264, 264, 44, 249, 6)).toEqual({ first: 237, last: 249 })
  })

  it('прокрутка за край (резиновая на iOS) не ломает окно', () => {
    expect(virtualWindow(-80, 264, 44, 249, 6)).toEqual({ first: 0, last: 12 })
    expect(virtualWindow(20_000, 264, 44, 249, 6)).toEqual({ first: 249, last: 249 })
  })

  it('пустой список и список короче окна', () => {
    expect(virtualWindow(0, 264, 44, 0, 6)).toEqual({ first: 0, last: 0 })
    expect(virtualWindow(0, 264, 44, 3, 6)).toEqual({ first: 0, last: 3 })
  })

  it('стрелкой ниже края — список докручивается ровно до строки', () => {
    expect(scrollTopToReveal(10, 44, 4, 0, 264)).toBe(4 + 11 * 44 - 264)
  })

  it('стрелкой выше края — строка встаёт наверх', () => {
    expect(scrollTopToReveal(3, 44, 4, 400, 264)).toBe(4 + 3 * 44)
  })

  it('видимая строка — прокрутка не меняется', () => {
    expect(scrollTopToReveal(5, 44, 4, 100, 264)).toBe(100)
  })

  it('при открытии выбранная страна — по центру', () => {
    expect(scrollTopToReveal(180, 44, 4, 0, 264, true)).toBe(4 + 180 * 44 - 132 + 22)
    expect(scrollTopToReveal(1, 44, 4, 0, 264, true)).toBe(0)
  })
})
