export const useAuthStore = defineStore('auth', () => {
  // Контекст Nuxt берём при создании стора: действия вызываются и из обработчиков событий
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()

  const user = ref<SessionUser | null>(null)
  // Сессию проверяем один раз: на сервере при первом рендере, состояние уходит в payload
  const loaded = ref(false)

  async function fetchUser() {
    // Для гостя сервер отвечает 204 без тела — $fetch вернёт undefined
    user.value = (await requestFetch<SessionUser | null>('/api/auth/me')) ?? null
    loaded.value = true
  }

  async function login(country: string, username: string) {
    const next = await $fetch<SessionUser>('/api/auth/login', { method: 'POST', body: { country, username } })
    // Кэш запросов мог остаться от другого игрока в этой вкладке
    nuxtApp.$queryClient.clear()
    user.value = next
    loaded.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    forget()
  }

  // Забыть игрока в этой вкладке (выход, смена игрока)
  function forget() {
    nuxtApp.$queryClient.clear()
    user.value = null
    loaded.value = true
  }

  // Сессия закончилась на сервере (ответ 401): забыть игрока и вернуть на вход.
  // Одно место для всех запросов — галереи, холста, автосохранения
  function expire() {
    forget()
    return nuxtApp.runWithContext(() => navigateTo('/login'))
  }

  return { user, loaded, fetchUser, login, logout, forget, expire }
})
