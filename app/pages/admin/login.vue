<script setup lang="ts">
useHead({ title: 'Вход' })

const route = useRoute()
const store = useAdminStore()

const username = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

async function submit() {
  if (pending.value) return
  error.value = ''
  pending.value = true
  try {
    await store.login(username.value, password.value)
    if (await navigateTo(safeAdminRedirect(route.query.redirect), { replace: true })) pending.value = false
  } catch (failure) {
    error.value = errorMessage(failure, 'Не получилось войти — проверьте интернет и попробуйте ещё раз')
    pending.value = false
  }
}
</script>

<template>
  <div class="admin-login">
    <form class="admin-card admin-login__card" @submit.prevent="submit">
      <h1 class="admin-login__title">Панель администратора</h1>
      <label class="admin-field">
        Логин
        <input v-model="username" class="admin-input" name="username" autocomplete="username" required autofocus>
      </label>
      <label class="admin-field">
        Пароль
        <input v-model="password" class="admin-input" type="password" name="password" autocomplete="current-password" required>
      </label>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <button type="submit" class="admin-button admin-button--primary" :disabled="pending">
        {{ pending ? 'Входим…' : 'Войти' }}
      </button>
    </form>
  </div>
</template>

<style scoped lang="scss">
.admin-login {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 24px 16px;
}

.admin-login__card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 360px;
  padding: 28px;
}

.admin-login__title {
  margin-bottom: 4px;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}
</style>
