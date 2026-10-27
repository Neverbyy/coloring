<template>
  <NuxtLink class="hub-button" :to="HOME_PATH" aria-label="К играм">
    <img src="~/assets/icons/home.svg" alt="" width="36" height="34">
  </NuxtLink>
</template>

<style scoped lang="scss">
.hub-button {
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
