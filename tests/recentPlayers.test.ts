import { describe, expect, it } from 'vitest'
import { RECENT_PLAYERS_LIMIT, forgetPlayer, parseRecentPlayers, rememberPlayer, seenAgo } from '../app/utils/recentPlayers'

const artem = { username: 'Артём', country: 'RU' }
const masha = { username: 'Маша', country: 'KZ' }

describe('быстрый вход: список игроков', () => {
  it.each([undefined, null, 'Артём', 42, { username: 'Артём', country: 'RU' }])('не список (%s) — пусто', (value) => {
    expect(parseRecentPlayers(value)).toEqual([])
  })

  it('отбрасывает записи с плохой страной или именем', () => {
    expect(parseRecentPlayers([
      artem,
      { username: 'Петя', country: 'XX' },
      { username: '<script>', country: 'RU' },
      { username: 'artem2015', country: 'RU' },
      { username: 'Вася' },
      null,
      'Маша',
      masha
    ])).toEqual([artem, masha])
  })

  it('убирает повторы без учёта регистра и лишние поля', () => {
    expect(parseRecentPlayers([{ ...artem, id: 'x' }, { username: 'артём', country: 'RU' }])).toEqual([artem])
  })

  it(`держит не больше ${RECENT_PLAYERS_LIMIT}`, () => {
    const names = ['Аня', 'Боря', 'Вера', 'Гоша', 'Даша', 'Егор']
    const list = parseRecentPlayers(names.map(username => ({ username, country: 'RU' })))
    expect(list.map(player => player.username)).toEqual(names.slice(0, RECENT_PLAYERS_LIMIT))
  })

  it('вошедший игрок встаёт первым, старая запись убирается', () => {
    const list = rememberPlayer([masha, artem], { username: 'артём', country: 'RU' })
    expect(list).toEqual([{ username: 'артём', country: 'RU' }, masha])
  })

  it('новый игрок вытесняет самого старого', () => {
    let list = [masha]
    for (const username of ['Аня', 'Боря', 'Вера', 'Гоша']) list = rememberPlayer(list, { username, country: 'RU' })
    expect(list.map(player => player.username)).toEqual(['Гоша', 'Вера', 'Боря', 'Аня'])
  })

  it('забыть игрока', () => {
    expect(forgetPlayer([artem, masha], 'АРТЁМ')).toEqual([masha])
    expect(forgetPlayer([masha], 'Артём')).toEqual([masha])
  })

  it('время входа сохраняется, неправильное отбрасывается вместе с полем', () => {
    expect(parseRecentPlayers([
      { ...artem, seenAt: 1_760_000_000_000 },
      { ...masha, seenAt: 'вчера' },
      { username: 'Вася', country: 'RU', seenAt: Number.NaN },
      { username: 'Петя', country: 'RU', seenAt: -5 }
    ])).toEqual([
      { ...artem, seenAt: 1_760_000_000_000 },
      masha,
      { username: 'Вася', country: 'RU' },
      { username: 'Петя', country: 'RU' }
    ])
  })

  it('повторный вход обновляет время', () => {
    const list = rememberPlayer([masha, { ...artem, seenAt: 1 }], { ...artem, seenAt: 2 })
    expect(list).toEqual([{ ...artem, seenAt: 2 }, masha])
  })
})

describe('быстрый вход: когда заходили', () => {
  const now = new Date(2026, 9, 23, 0, 10).getTime()
  const daysAgo = (days: number, hours = 12) => new Date(2026, 9, 23 - days, hours).getTime()

  it.each([
    [daysAgo(0, 0), 'сегодня'],
    [now + 60_000, 'сегодня'],
    [new Date(2026, 9, 22, 23, 50).getTime(), 'вчера'],
    [daysAgo(1, 1), 'вчера'],
    [daysAgo(2), '2 дня назад'],
    [daysAgo(4), '4 дня назад'],
    [daysAgo(5), '5 дней назад'],
    [daysAgo(7), 'неделю назад'],
    [daysAgo(13), 'неделю назад'],
    [daysAgo(14), '2 недели назад'],
    [daysAgo(29), '4 недели назад'],
    [daysAgo(30), 'месяц назад'],
    [daysAgo(65), '2 месяца назад'],
    [daysAgo(150), '5 месяцев назад'],
    [daysAgo(400), 'больше года назад']
  ])('%s → %s', (seenAt, label) => {
    expect(seenAgo(seenAt, now)).toBe(label)
  })
})
