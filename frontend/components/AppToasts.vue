<template>
  <div class="toasts" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts.items"
        :key="toast.id"
        class="toast"
        :class="`toast-${toast.type}`"
        role="status"
      >
        <span class="toast-icon" aria-hidden="true">{{ toast.type === 'success' ? '✓' : '!' }}</span>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" aria-label="Закрыть" @click="toasts.dismiss(toast.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const toasts = useToastsStore()
</script>

<style scoped>
.toasts {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: min(360px, calc(100vw - 2rem));
}
.toast {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 0.9rem;
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  background: var(--surface);
  border: 1px solid var(--border);
  font-size: 0.9rem;
}
.toast-success {
  border-color: #b2f2bb;
  background: #ebfbee;
  color: #1e7a34;
}
.toast-error {
  border-color: #ffc9c9;
  background: #fff5f5;
  color: var(--danger-hover);
}
.toast-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
}
.toast-success .toast-icon {
  background: var(--success);
}
.toast-error .toast-icon {
  background: var(--danger);
}
.toast-message {
  flex: 1;
}
.toast-close {
  background: none;
  border: none;
  padding: 0 0.2rem;
  font-size: 1.1rem;
  line-height: 1;
  color: inherit;
  opacity: 0.6;
}
.toast-close:hover {
  opacity: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(0.6rem);
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
