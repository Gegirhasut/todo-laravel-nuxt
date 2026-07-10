<template>
  <AppModal :title="title" size="narrow" @close="emit('cancel')">
    <p class="muted message">{{ message }}</p>

    <div v-if="error" class="alert-error confirm-alert" role="alert">
      {{ error }}
    </div>

    <div class="confirm-actions">
      <button class="btn-ghost" :disabled="busy" @click="emit('cancel')">
        {{ cancelLabel }}
      </button>
      <button class="btn-danger" :disabled="busy" @click="emit('confirm')">
        <span v-if="busy" class="spinner spinner-dark" aria-hidden="true" />
        {{ confirmLabel }}
      </button>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    busy?: boolean
    error?: string | null
  }>(),
  {
    confirmLabel: 'Удалить',
    cancelLabel: 'Отмена',
    busy: false,
    error: null,
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<style scoped>
.message {
  margin: 0;
}
.confirm-alert {
  margin-top: 1rem;
}
.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.25rem;
}
</style>
