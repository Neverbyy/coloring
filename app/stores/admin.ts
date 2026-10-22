export const useAdminStore = defineStore('admin', () => {
  const nuxtApp = useNuxtApp()

  const admin = ref<SessionAdmin | null>(null)
  const loaded = ref(false)

  async function fetchAdmin() {
    admin.value = (await $fetch<SessionAdmin | null>('/api/admin/auth/me')) ?? null
    loaded.value = true
  }

  async function login(username: string, password: string) {
    admin.value = await $fetch<SessionAdmin>('/api/admin/auth/login', { method: 'POST', body: { username, password } })
    loaded.value = true
  }

  async function logout() {
    await $fetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => {})
    forget()
  }

  function forget() {
    nuxtApp.$queryClient.removeQueries({ queryKey: ['admin'] })
    admin.value = null
    loaded.value = true
  }

  function expire() {
    forget()
    return nuxtApp.runWithContext(() => {
      const current = useRouter().currentRoute.value.fullPath
      return navigateTo({ path: ADMIN_LOGIN_PATH, query: { redirect: current } })
    })
  }

  return { admin, loaded, fetchAdmin, login, logout, forget, expire }
})
