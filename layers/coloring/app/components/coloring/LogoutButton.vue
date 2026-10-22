<script setup lang="ts">
const auth = useAuthStore()
const leaving = ref(false)

async function logout() {
  if (leaving.value) return
  leaving.value = true
  try {
    await auth.logout()
  } catch {
    auth.forget()
  }
  await navigateTo('/login', { replace: true })
}
</script>

<template>
  <button type="button" class="logout-button" aria-label="Выйти" :disabled="leaving" @click="logout">
    <img src="../../assets/icons/logout.svg" alt="" width="34" height="32">
  </button>
</template>

<style scoped lang="scss">
.logout-button {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border: 6px solid $color-frame;
  border-radius: 20px;
  background: #fff;
  transition: transform 0.1s;
  @include pressable(0.92);

  img {
    display: block;
  }
}
</style>
