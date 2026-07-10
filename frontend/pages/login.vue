<template>
  <div class="login-wrap">
    <div class="card login-card">
      <h1 class="login-title">Sign in</h1>
      <p class="muted login-sub">Use one of the seeded test accounts below.</p>

      <div v-if="auth.error" class="alert-error login-alert" role="alert">
        {{ auth.error }}
      </div>

      <form novalidate @submit.prevent="submit">
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            placeholder="user@example.com"
            :aria-invalid="!!errors.email"
          >
          <p v-if="errors.email" class="field-error">{{ errors.email }}</p>
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="password"
            :aria-invalid="!!errors.password"
          >
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <button class="btn-primary submit" type="submit" :disabled="auth.loading">
          <span v-if="auth.loading" class="spinner" />
          {{ auth.loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>

      <div class="hint muted">
        <strong>Test accounts</strong><br>
        admin@example.com / password<br>
        user@example.com / password
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'guest', layout: false })

const auth = useAuthStore()
const route = useRoute()

const email = ref('')
const password = ref('')
const errors = reactive<{ email?: string; password?: string }>({})

async function submit() {
  errors.email = email.value.trim() ? undefined : 'Email is required.'
  errors.password = password.value ? undefined : 'Password is required.'
  if (errors.email || errors.password) return

  if (await auth.login(email.value.trim(), password.value)) {
    await navigateTo((route.query.redirect as string) || '/')
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.login-card {
  width: 100%;
  max-width: 380px;
  padding: 2rem;
}
.login-title {
  margin: 0 0 0.25rem;
}
.login-sub {
  margin: 0 0 1.5rem;
  font-size: 0.9rem;
}
.login-alert {
  margin-bottom: 1rem;
}
.submit {
  width: 100%;
}
.hint {
  margin-top: 1.5rem;
  font-size: 0.8rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
  line-height: 1.7;
}
</style>
