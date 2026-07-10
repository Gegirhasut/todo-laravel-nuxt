<template>
  <div>
    <a href="#main" class="skip-link">Перейти к содержимому</a>

    <header v-if="auth.isAuthenticated" class="app-header">
      <div class="app-header-inner">
        <NuxtLink to="/" class="brand">Задачи</NuxtLink>

        <nav class="header-right" aria-label="Учётная запись">
          <button
            class="btn-ghost btn-sm theme-toggle"
            :aria-label="theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'"
            :aria-pressed="theme === 'dark'"
            @click="toggle()"
          >
            <!-- Sun / moon drawn inline, so no external icon assets. -->
            <svg v-if="theme === 'dark'" class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg v-else class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          </button>

          <span class="muted user-info">
            {{ auth.user?.name }}
            <span v-if="auth.isAdmin" class="badge badge-in_progress">админ</span>
          </span>
          <button class="btn-ghost btn-sm" @click="auth.logout()">Выйти</button>
        </nav>
      </div>
    </header>

    <main id="main" tabindex="-1">
      <slot />
    </main>

    <AppToasts />
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const { theme, toggle } = useTheme()
</script>

<style scoped>
.app-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.app-header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0.85rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.brand {
  font-weight: 700;
  font-size: 1.15rem;
  color: var(--text);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}
.user-info {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.theme-toggle {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem;
}
.theme-icon {
  width: 18px;
  height: 18px;
}
</style>
