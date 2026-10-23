export function useRecentPlayers() {
  const cookie = useCookie<unknown>('quick_login', {
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    path: '/'
  })

  const players = computed(() => parseRecentPlayers(cookie.value))

  function remember(player: RecentPlayer) {
    cookie.value = rememberPlayer(players.value, { username: player.username, country: player.country, seenAt: Date.now() })
  }

  function forget(username: string) {
    cookie.value = forgetPlayer(players.value, username)
  }

  return { players, remember, forget }
}
