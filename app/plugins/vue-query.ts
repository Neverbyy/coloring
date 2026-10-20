import { QueryClient, VueQueryPlugin, dehydrate, hydrate, type DehydratedState } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const queryState = useState<DehydratedState | null>('vue-query', () => null)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1
      }
    }
  })

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })

  if (import.meta.server) {
    nuxtApp.hooks.hook('app:rendered', () => {
      queryState.value = dehydrate(queryClient)
    })
  }

  if (import.meta.client) {
    nuxtApp.hooks.hook('app:created', () => {
      if (queryState.value) hydrate(queryClient, queryState.value)
    })
  }
})
