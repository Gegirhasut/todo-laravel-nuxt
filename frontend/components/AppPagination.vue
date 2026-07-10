<template>
  <nav v-if="meta && meta.last_page > 1" class="pagination" aria-label="Навигация по страницам">
    <button
      class="btn-ghost btn-sm"
      :disabled="meta.current_page <= 1"
      @click="emit('change', meta.current_page - 1)"
    >
      Назад
    </button>

    <span class="muted page-info" aria-live="polite">
      Страница {{ meta.current_page }} из {{ meta.last_page }}
      <span class="total">(всего {{ meta.total }})</span>
    </span>

    <button
      class="btn-ghost btn-sm"
      :disabled="meta.current_page >= meta.last_page"
      @click="emit('change', meta.current_page + 1)"
    >
      Вперёд
    </button>
  </nav>
</template>

<script setup lang="ts">
import type { PaginationMeta } from '~/types'

defineProps<{ meta: PaginationMeta | null }>()

const emit = defineEmits<{ change: [page: number] }>()
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}
.page-info {
  font-size: 0.85rem;
}
.total {
  opacity: 0.7;
}
</style>
