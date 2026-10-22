<script setup lang="ts">
definePageMeta({ admin: true })

const store = useAdminStore()
const route = useRoute()
const { admin: adminConfig } = useAppConfig()

useHead({
  title: 'Админка',
  titleTemplate: title => title && title !== 'Админка' ? `${title} — Админка` : 'Админка — Раскраска',
  htmlAttrs: { class: 'admin' },
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'robots', content: 'noindex, nofollow' }
  ]
})

const showNav = computed(() => !!store.admin && route.path !== ADMIN_LOGIN_PATH)

function isActive(to: string): boolean {
  return to === ADMIN_HOME_PATH ? route.path === to : route.path === to || route.path.startsWith(`${to}/`)
}

const menuOpen = ref(false)
watch(() => route.fullPath, () => {
  menuOpen.value = false
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') menuOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

async function logout() {
  await store.logout()
  await navigateTo(ADMIN_LOGIN_PATH)
}
</script>

<template>
  <div class="admin-shell" :class="{ 'admin-shell--bare': !showNav }">
    <aside v-if="showNav" class="admin-shell__nav" :class="{ 'admin-shell__nav--open': menuOpen }">
      <div class="admin-shell__bar">
        <NuxtLink class="admin-shell__logo" :to="ADMIN_HOME_PATH">
          Раскраска
          <span>Админ панель</span>
        </NuxtLink>
        <button
          type="button"
          class="admin-shell__burger"
          aria-controls="admin-menu"
          :aria-expanded="menuOpen"
          :aria-label="menuOpen ? 'Закрыть меню' : 'Открыть меню'"
          @click="menuOpen = !menuOpen"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            <path
              v-if="menuOpen"
              d="M6 6l12 12M18 6L6 18"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            />
            <path v-else d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <div id="admin-menu" class="admin-shell__menu">
        <nav class="admin-shell__links" aria-label="Разделы">
          <NuxtLink
            v-for="section in adminConfig.sections"
            :key="section.to"
            class="admin-shell__link"
            :class="{ 'admin-shell__link--active': isActive(section.to) }"
            :to="section.to"
          >
            {{ section.label }}
          </NuxtLink>
        </nav>
        <div class="admin-shell__account">
          <span class="admin-shell__name">{{ store.admin?.username }}</span>
          <button type="button" class="admin-shell__logout" @click="logout">Выйти</button>
        </div>
      </div>
    </aside>
    <div v-if="showNav && menuOpen" class="admin-shell__backdrop" aria-hidden="true" @click="menuOpen = false" />
    <main class="admin-shell__main">
      <NuxtPage />
    </main>
  </div>
</template>

<style lang="scss" src="~/assets/styles/admin.scss"></style>

<style scoped lang="scss">
$nav-width: 232px;
$menu-breakpoint: 800px;
$bar-height: 56px;

.admin-shell {
  display: grid;
  grid-template-columns: $nav-width minmax(0, 1fr);
  min-height: 100vh;
}

.admin-shell--bare {
  display: block;
}

.admin-shell__nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 28px;
  height: 100vh;
  padding: 24px 14px;
  background: $color-ink;
  color: #fff;
}

.admin-shell__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.admin-shell__logo {
  display: flex;
  flex-direction: column;
  padding: 0 10px;
  color: #fff;
  font: 26px/1 $font-display;
  text-decoration: none;

  span {
    margin-top: 6px;
    color: rgba(#fff, 0.6);
    font: 600 12px/1 system-ui, sans-serif;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
}

.admin-shell__burger {
  display: none;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  color: #fff;

  &:hover {
    background: rgba(#fff, 0.1);
  }
}

.admin-shell__menu {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 28px;
  min-height: 0;
}

.admin-shell__links {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.admin-shell__link {
  padding: 10px 12px;
  border-radius: 8px;
  color: rgba(#fff, 0.72);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;

  &:hover {
    background: rgba(#fff, 0.08);
    color: #fff;
  }
}

.admin-shell__link--active {
  background: rgba(#fff, 0.14);
  color: #fff;
}

.admin-shell__account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding: 12px 10px 0;
  border-top: 1px solid rgba(#fff, 0.12);
  font-size: 14px;
}

.admin-shell__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-shell__logout {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 8px;
  color: rgba(#fff, 0.8);
  font-size: 14px;
  font-weight: 600;

  &:hover {
    background: rgba(#fff, 0.1);
    color: #fff;
  }
}

.admin-shell__backdrop {
  display: none;
}

.admin-shell__main {
  width: 100%;
  max-width: 1280px;
  padding: 32px 40px 48px;
}

.admin-shell--bare .admin-shell__main {
  max-width: none;
  padding: 0;
}

@media (max-width: $menu-breakpoint) {
  .admin-shell {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }

  .admin-shell__nav {
    gap: 0;
    height: auto;
    padding: 0;
  }

  .admin-shell__bar {
    height: $bar-height;
    padding: 0 8px 0 12px;
  }

  .admin-shell__logo {
    padding: 0 4px;
    font-size: 20px;

    span {
      display: none;
    }
  }

  .admin-shell__burger {
    display: grid;
  }

  .admin-shell__menu {
    position: absolute;
    top: 100%;
    right: 0;
    left: 0;
    display: none;
    gap: 12px;
    max-height: calc(100dvh - #{$bar-height});
    padding: 4px 12px 16px;
    overflow-y: auto;
    border-top: 1px solid rgba(#fff, 0.12);
    background: $color-ink;
    box-shadow: 0 12px 24px rgba($color-ink, 0.3);
  }

  .admin-shell__nav--open .admin-shell__menu {
    display: flex;
    animation: admin-menu-in 0.15s ease-out;
  }

  .admin-shell__link {
    padding: 12px;
    font-size: 16px;
  }

  .admin-shell__account {
    margin-top: 0;
  }

  .admin-shell__backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: block;
    background: rgba($color-ink, 0.35);
  }

  .admin-shell__main {
    padding: 20px 16px 40px;
  }
}

@keyframes admin-menu-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}
</style>
