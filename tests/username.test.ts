import { describe, expect, it } from 'vitest'
import { normalizeUsername, usernameCharsProblem, usernameKey, validateUsername } from '../shared/utils/username'

const ONLY_LETTERS = 'Имя может состоять только из букв'

describe('имя игрока', () => {
  it.each(['Маша', 'Artem', 'Васёк', 'José', 'José', 'Кимчи', 'दीपक', '  Петя  '])('%s подходит', (name) => {
    expect(validateUsername(name)).toBeNull()
  })

  it.each([
    'dsgf-',
    'artem2015',
    '654!@32__',
    'Маша Петрова',
    'tab\tname',
    'Аня!@',
    '___',
    '<script>',
    'emoji😀',
    '́abc',
    'Маша️',
    'Ма​ша',
    'ㅤㅤㅤ'
  ])('%s отклоняется', (name) => {
    expect(validateUsername(name)).toBe(ONLY_LETTERS)
  })

  it('длина считается без пробелов по краям', () => {
    expect(validateUsername('  ab  ')).toBe('Имя — минимум 3 символа')
    expect(validateUsername('')).toBe('Имя — минимум 3 символа')
    expect(validateUsername('a'.repeat(21))).toBe('Имя — максимум 20 символов')
    expect(validateUsername('a'.repeat(20))).toBeNull()
  })

  it('недопустимые символы важнее длины', () => {
    expect(validateUsername('a1')).toBe(ONLY_LETTERS)
  })

  it('проверка символов при вводе не ругается на короткое и пустое имя', () => {
    expect(usernameCharsProblem('')).toBeNull()
    expect(usernameCharsProblem('ab')).toBeNull()
    expect(usernameCharsProblem('ab ')).toBeNull()
    expect(usernameCharsProblem('a-')).toBe(ONLY_LETTERS)
  })

  it('одно и то же имя в разных регистрах и формах Unicode — один игрок', () => {
    expect(usernameKey('Маша')).toBe(usernameKey('МАША'))
    expect(usernameKey('José')).toBe(usernameKey('José'))
    expect(normalizeUsername('  Петя ')).toBe('Петя')
  })
})
