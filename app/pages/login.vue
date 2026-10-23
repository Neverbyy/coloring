<script setup lang="ts">
definePageMeta({ guestOnly: true })
useHead({ title: 'Вход — Раскраска' })

const route = useRoute()
const auth = useAuthStore()
const countries = useCountryOptions()

const country = ref('')
const username = ref('')
const error = ref('')
const pending = ref(false)
const nameTouched = ref(false)

const nameError = computed(() => nameTouched.value ? validateUsername(username.value) : usernameCharsProblem(username.value))
const message = computed(() => nameError.value ?? error.value)

watch([country, username], () => {
  error.value = ''
})

onMounted(() => {
  if (!country.value) country.value = detectCountry()
})

function onNameBlur() {
  if (normalizeUsername(username.value)) nameTouched.value = true
}

async function submit() {
  if (pending.value) return
  nameTouched.value = true
  error.value = ''
  const problem = validateLogin(country.value, username.value)
  if (problem) {
    error.value = problem
    return
  }

  pending.value = true
  try {
    await auth.login(country.value, normalizeUsername(username.value))
    if (await navigateTo(safeRedirect(route.query.redirect), { replace: true })) pending.value = false
  } catch (failure) {
    error.value = errorMessage(failure, 'Не получилось войти — проверь интернет и попробуй ещё раз')
    pending.value = false
  }
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
          :class="{ 'login__field--invalid': nameError }"
          type="text"
          placeholder="Имя"
          aria-label="Имя"
          aria-describedby="login-error"
          :aria-invalid="nameError ? 'true' : undefined"
          autocomplete="username"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="go"
          :maxlength="USERNAME_MAX_LENGTH"
          @blur="onNameBlur"
        >
      </div>

      <p id="login-error" class="login__error" role="alert">{{ message }}</p>

      <button class="login__submit" type="submit" :disabled="pending">
        {{ pending ? 'Входим…' : 'Играть' }}
      </button>
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
  @include frame-card;
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
  @include text-field;
  min-width: 0;
  outline: none;

  &::placeholder {
    color: $color-placeholder;
  }

  &:focus {
    border-color: $color-sky;
  }
}

.login__field--invalid,
.login__field--invalid:focus {
  border-color: $color-error;
}

.login__error {
  min-height: 20px;
  font-size: 16px;
  font-weight: 500;
  line-height: 20px;
  color: $color-error;
}

.login__submit {
  height: 60px;
  border-radius: 24px;
  @include accent-button(6px);
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 6px;
  transition: transform 0.1s, box-shadow 0.1s, opacity 0.15s;

  &:active:not(:disabled) {
    transform: translateY(4px);
    box-shadow: 0 2px 0 $color-accent-shadow;
  }

  &:disabled {
    opacity: 0.7;
  }
}
</style>
