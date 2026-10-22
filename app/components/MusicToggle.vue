<script setup lang="ts">
const audio = useAudioStore()
</script>

<template>
  <button
    type="button"
    class="music-toggle"
    :aria-label="audio.musicOn ? 'Выключить музыку' : 'Включить музыку'"
    :aria-pressed="audio.musicOn"
    @click="audio.toggleMusic()"
  >
    <svg width="36" height="32" viewBox="0 0 36 32" fill="none" aria-hidden="true">
      <path d="M3 11.5C3 10.12 4.12 9 5.5 9H10L17.5 2.8C18.8 1.73 20.75 2.66 20.75 4.34V27.66C20.75 29.34 18.8 30.27 17.5 29.2L10 23H5.5C4.12 23 3 21.88 3 20.5V11.5Z" fill="#F08A5D" />
      <path d="M3 18H10L17.5 24.2C18.8 25.27 20.75 24.34 20.75 22.66V27.66C20.75 29.34 18.8 30.27 17.5 29.2L10 23H5.5C4.12 23 3 21.88 3 20.5V18Z" fill="#B46846" />
      <path d="M3 11.5C3 10.12 4.12 9 5.5 9H10L17.5 2.8C18.8 1.73 20.75 2.66 20.75 4.34V27.66C20.75 29.34 18.8 30.27 17.5 29.2L10 23H5.5C4.12 23 3 21.88 3 20.5V11.5Z" stroke="#4D3F80" stroke-width="2.5" stroke-linejoin="round" />
      <template v-if="audio.musicOn">
        <path d="M25.5 11.5C27 12.9 27.75 14.4 27.75 16C27.75 17.6 27 19.1 25.5 20.5" stroke="#4D3F80" stroke-width="3" stroke-linecap="round" />
        <path d="M29.5 7.5C32 9.9 33.25 12.73 33.25 16C33.25 19.27 32 22.1 29.5 24.5" stroke="#4D3F80" stroke-width="3" stroke-linecap="round" />
      </template>
      <path v-else d="M25 11.5L33 20.5M33 11.5L25 20.5" stroke="#4D3F80" stroke-width="3" stroke-linecap="round" />
    </svg>
  </button>
</template>

<style scoped lang="scss">
.music-toggle {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 6px solid $color-frame;
  border-radius: 20px;
  background: #fff;
  transition: transform 0.1s;
  @include pressable(0.92);

  svg {
    display: block;
  }
}
</style>
