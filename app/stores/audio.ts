export const useAudioStore = defineStore('audio', () => {
  const cookie = useCookie<'on' | 'off'>('music', {
    default: () => 'on',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    path: '/'
  })

  const musicOn = computed(() => cookie.value !== 'off')

  function toggleMusic() {
    cookie.value = musicOn.value ? 'off' : 'on'
  }

  return { musicOn, toggleMusic }
})
