<script setup lang="ts">
definePageMeta({ guestOnly: true })
useHead({ title: 'Вход — Раскраска' })

const route = useRoute()
const auth = useAuthStore()
const countries = useCountryOptions()
const { players: savedPlayers, remember, forget } = useRecentPlayers()

if (auth.previousUser) {
  remember(auth.previousUser)
  auth.previousUser = null
}

const recentPlayers = shallowRef(savedPlayers.value)

const mode = ref<'form' | 'quick'>('form')
const now = ref(0)
const country = ref('')
const username = ref('')
const error = ref('')
const pending = ref(false)
const enteringAs = ref<string | null>(null)
const nameTouched = ref(false)

const nameError = computed(() => nameTouched.value ? validateUsername(username.value) : usernameCharsProblem(username.value))
const message = computed(() => nameError.value ?? error.value)

watch([country, username, mode], () => {
  error.value = ''
})

onMounted(() => {
  if (!country.value) country.value = detectCountry()
})

function onNameBlur() {
  if (normalizeUsername(username.value)) nameTouched.value = true
}

function stopEntering() {
  pending.value = false
  enteringAs.value = null
  recentPlayers.value = savedPlayers.value
}

async function enter(nextCountry: string, nextUsername: string) {
  pending.value = true
  try {
    await auth.login(nextCountry, nextUsername)
    if (auth.user) remember(auth.user)
    if (await navigateTo(safeRedirect(route.query.redirect), { replace: true })) stopEntering()
  } catch (failure) {
    error.value = errorMessage(failure, 'Не получилось войти — проверь интернет и попробуй ещё раз')
    stopEntering()
  }
}

function submit() {
  if (pending.value) return
  nameTouched.value = true
  error.value = ''
  const problem = validateLogin(country.value, username.value)
  if (problem) {
    error.value = problem
    return
  }
  enter(country.value, normalizeUsername(username.value))
}

function openQuick() {
  now.value = Date.now()
  mode.value = 'quick'
}

function quickLogin(player: RecentPlayer) {
  if (pending.value) return
  error.value = ''
  enteringAs.value = player.username
  enter(player.country, player.username)
}

function forgetRecent(player: RecentPlayer) {
  forget(player.username)
  recentPlayers.value = savedPlayers.value
  if (!recentPlayers.value.length) mode.value = 'form'
}
</script>

<template>
  <main class="login">
    <div class="login__card">
      <h1 class="login__title">Раскраска</h1>
      <p class="login__subtitle">{{ mode === 'quick' ? 'Кто играет?' : 'Выбери страну и придумай имя' }}</p>

      <Transition name="login-mode" mode="out-in">
        <form v-if="mode === 'form'" key="form" class="login__body" novalidate @submit.prevent="submit">
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

          <button v-if="recentPlayers.length" class="login__secondary" type="button" :disabled="pending" @click="openQuick">
            Быстрый вход
          </button>
        </form>

        <div v-else key="quick" class="login__body">
          <ul class="login__players" aria-label="Быстрый вход">
            <li
              v-for="player in recentPlayers"
              :key="player.username"
              class="login__player"
              :class="{ 'login__player--entering': enteringAs === player.username }"
            >
              <button
                class="login__player-enter"
                type="button"
                :disabled="pending"
                :aria-busy="enteringAs === player.username || undefined"
                @click="quickLogin(player)"
              >
                <img class="login__flag" :src="flagUrl(player.country)" alt="" width="24" height="18">
                <span class="login__player-text">
                  <span class="login__player-name">{{ player.username }}</span>
                  <span v-if="player.seenAt" class="login__player-details">{{ seenAgo(player.seenAt, now) }}</span>
                </span>
              </button>
              <LoadingSpinner v-if="enteringAs === player.username" class="login__spinner" :size="24" delayed />
              <button
                v-else
                class="login__forget"
                type="button"
                :aria-label="`Забыть «${player.username}» на этом устройстве`"
                :disabled="pending"
                @click="forgetRecent(player)"
              >
                ×
              </button>
            </li>
          </ul>

          <p class="login__error" role="alert">{{ error }}</p>

          <button class="login__secondary" type="button" :disabled="pending" @click="mode = 'form'">
            ← Назад
          </button>
        </div>
      </Transition>
    </div>
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

.login__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.login-mode-enter-active,
.login-mode-leave-active {
  transition: opacity 0.12s;
}

.login-mode-enter-from,
.login-mode-leave-to {
  opacity: 0;
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

.login__secondary,
.login__player-enter {
  @include text-field;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s, opacity 0.15s;
  @include pressable(0.98);

  @include on-hover {
    border-color: $color-sky;
  }

  &:focus-visible {
    outline: none;
    border-color: $color-sky;
  }

  &:disabled {
    opacity: 0.7;
    cursor: default;
  }
}

.login__players {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 4px;
  list-style: none;
}

.login__player {
  position: relative;
}

.login__player-enter {
  display: flex;
  align-items: center;
  gap: 10px;
  height: auto;
  min-height: 56px;
  padding: 10px 52px 10px 16px;
  text-align: left;
}

.login__player--entering .login__player-enter:disabled {
  border-color: $color-sky;
  opacity: 1;
}

.login__spinner {
  position: absolute;
  top: 50%;
  right: 14px;
  margin-top: -12px;
  pointer-events: none;
}

.login__player-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.login__flag {
  flex: none;
  width: 24px;
  height: 18px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba($color-ink, 0.12);
  object-fit: cover;
}

.login__player-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.login__player-details {
  font-size: 15px;
  font-weight: 500;
  line-height: 1.2;
  color: rgba($color-ink, 0.6);
}

.login__forget {
  position: absolute;
  top: 4px;
  right: 4px;
  bottom: 4px;
  width: 44px;
  padding: 0;
  border: 0;
  border-radius: 20px;
  background: none;
  color: $color-placeholder;
  font: 400 32px/1 $font-body;
  cursor: pointer;
  transition: color 0.15s;

  @include on-hover {
    color: $color-ink;
  }

  &:focus-visible {
    outline: 3px solid $color-sky;
    outline-offset: -3px;
  }

  &:disabled {
    cursor: default;
  }
}
</style>
