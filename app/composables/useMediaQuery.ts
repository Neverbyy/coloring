// Совпадает ли медиазапрос. На сервере и до монтирования — false: раскладку для SSR задаёт CSS
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false)
  let list: MediaQueryList | undefined
  const update = () => {
    matches.value = list?.matches ?? false
  }

  onMounted(() => {
    list = window.matchMedia(query)
    update()
    list.addEventListener('change', update)
  })
  onBeforeUnmount(() => list?.removeEventListener('change', update))

  return readonly(matches)
}
