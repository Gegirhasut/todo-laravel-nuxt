<template>
  <div>
    <a href="#main" class="skip-link">Перейти к содержимому</a>

    <header v-if="auth.isAuthenticated" class="app-header">
      <div class="app-header-inner">
        <NuxtLink to="/" class="brand">Задачи</NuxtLink>

        <nav class="header-right" aria-label="Учётная запись">
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
</style>
