export const useAuthStore = defineStore('auth', () => {
  const nuxtApp = useNuxtApp()
  const requestFetch = useRequestFetch()

  const user = ref<SessionUser | null>(null)
  const loaded = ref(false)

  async function fetchUser() {
    user.value = (await requestFetch<SessionUser | null>('/api/auth/me')) ?? null
    loaded.value = true
  }

  async function login(country: string, username: string) {
    const next = await $fetch<SessionUser>('/api/auth/login', { method: 'POST', body: { country, username } })
    nuxtApp.$queryClient.clear()
    user.value = next
    loaded.value = true
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    forget()
  }

  function forget() {
    nuxtApp.$queryClient.clear()
    user.value = null
    loaded.value = true
  }

  function expire() {
    forget()
    return nuxtApp.runWithContext(() => navigateTo('/login'))
  }

  return { user, loaded, fetchUser, login, logout, forget, expire }
})
