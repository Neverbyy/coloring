<script setup lang="ts">
useHead({ title: 'Вход — Раскраска' })

const countries = useCountryOptions()

const country = ref('')
const username = ref('')
const error = ref('')

onMounted(() => {
  if (!country.value) country.value = detectCountry()
})

async function submit() {
  error.value = ''
  if (!isCountryCode(country.value)) {
    error.value = 'Выбери страну'
    return
  }
  const problem = validateUsername(username.value)
  if (problem) {
    error.value = problem
    return
  }
  // Сессия появится вместе с сервером, пока просто открываем галерею
  await navigateTo('/coloring')
}
</script>

<template>
  <main class="login">
    <form class="login__card" novalidate @submit.prevent="submit">
      <h1 class="login__title">Раскраска</h1>
      <p class="login__subtitle">Выбери страну и придумай имя</p>

      <div class="login__fields">
        <CountrySelect v-model="country" :options="countries" placeholder="Страна" />

        <input
          v-model="username"
          class="login__field"
          type="text"
          placeholder="Имя"
          aria-label="Имя"
          autocomplete="username"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          :maxlength="USERNAME_MAX_LENGTH"
        >
      </div>

      <p class="login__error" role="alert">{{ error }}</p>

      <button class="login__submit" type="submit">Играть</button>
    </form>
  </main>
</template>

<style scoped lang="scss">
.login {
  position: fixed;
  inset: 0;
  display: flex;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding:
    max(24px, env(safe-area-inset-top))
    max(24px, env(safe-area-inset-right))
    max(24px, env(safe-area-inset-bottom))
    max(24px, env(safe-area-inset-left));
  background: $color-sky;
}

.login__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 560px;
  margin: auto;
  padding: 24px 32px;
  border: $frame-border solid $color-frame;
  border-radius: $frame-radius;
  background: #fff;
  text-align: center;

  @media (max-width: 479px) {
    padding: 24px 16px;
  }
}

.login__title {
  font-family: $font-display;
  font-size: 40px;
  font-weight: 400;
  line-height: 1;
  color: $color-ink;

  @media (max-height: 480px) {
    font-size: 32px;
  }
}

.login__subtitle {
  font-size: 16px;
  font-weight: 500;
  color: rgba($color-ink, 0.6);
}

.login__fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  margin-top: 4px;
}

.login__field {
  width: 100%;
  min-width: 0;
  height: 56px;
  padding: 0 20px;
  border: 4px solid $color-frame;
  border-radius: 24px;
  outline: none;
  background: #fff;
  color: $color-ink;
  // Не меньше 16px — иначе iOS зумит страницу при фокусе
  font: 500 20px/1 $font-body;
  transition: border-color 0.15s;

  &::placeholder {
    color: rgba($color-ink, 0.4);
  }

  &:focus {
    border-color: $color-sky;
  }
}

.login__error {
  min-height: 20px;
  font-size: 16px;
  font-weight: 500;
  line-height: 20px;
  color: #e8112d;
}

.login__submit {
  height: 60px;
  border-radius: 24px;
  background: $color-accent;
  box-shadow: 0 6px 0 $color-accent-shadow;
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
  transition: transform 0.1s, box-shadow 0.1s;

  &:active {
    transform: translateY(4px);
    box-shadow: 0 2px 0 $color-accent-shadow;
  }
}
</style>
