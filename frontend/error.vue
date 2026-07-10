<template>
  <div class="container">
    <div class="card error-card">
      <h1 class="code">{{ error.statusCode }}</h1>
      <p class="muted">{{ error.message || 'Что-то пошло не так.' }}</p>
      <button class="btn-primary" @click="clearError({ redirect: '/' })">На главную</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()
</script>

<style scoped>
.error-card {
  padding: 2.5rem 2rem;
  text-align: center;
  max-width: 420px;
  margin: 4rem auto 0;
}
.code {
  margin: 0 0 0.25rem;
  font-size: 2.5rem;
}
</style>
