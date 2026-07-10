<template>
  <article class="task-row card">
    <div class="task-head">
      <h2 class="task-title" :class="{ done: task.status === 'completed' }">
        <!-- A real link (copyable, middle-clickable, tabbable) stretched over
             the whole row, so the entire card is one click target. The click
             also tells the list to stack the detail as an overlay. -->
        <NuxtLink :to="`/tasks/${task.id}`" class="task-link" @click="emit('open')">
          {{ task.title }}
        </NuxtLink>
      </h2>
      <span class="badge" :class="`badge-${task.status}`">{{ statusLabel(task.status) }}</span>

      <!-- Only worth saying when the list also holds other people's tasks. -->
      <span v-if="showOwner && isOwn" class="badge badge-own">Моя</span>
    </div>

    <p v-if="task.description" class="task-desc muted">{{ task.description }}</p>

    <div class="task-meta muted">
      <span v-if="task.due_date" class="due" :class="{ overdue: isOverdue(task.due_date, task.status) }">
        <svg class="meta-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4m8-4v4M3 10h18" />
        </svg>
        <span class="sr-only">Срок:</span>
        {{ formatDate(task.due_date) }}
      </span>
      <span v-else class="no-due">Без срока</span>

      <!-- The «Моя» badge already says whose it is, so don't repeat the name. -->
      <span v-if="showOwner && !isOwn && task.owner">· {{ task.owner.name }}</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

const props = withDefaults(
  defineProps<{
    task: Task
    /** True when the list mixes several owners, i.e. the admin's list. */
    showOwner?: boolean
  }>(),
  { showOwner: false },
)

const emit = defineEmits<{
  /** The row was clicked — the list opens the detail as an overlay. */
  open: []
}>()

const auth = useAuthStore()

const isOwn = computed(() => props.task.user_id === auth.user?.id)
</script>

<style scoped>
.task-row {
  position: relative;
  padding: var(--space-4) var(--space-5);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.task-row:hover {
  border-color: var(--primary);
  box-shadow: var(--shadow);
}
.task-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.task-title {
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.4;
  margin: 0;
  min-width: 0;
  overflow-wrap: break-word;
}
.task-title.done {
  text-decoration: line-through;
  color: var(--muted);
}
.task-link {
  color: inherit;
}
/* Stretch the link's hit area over the whole card. */
.task-link::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
}
.task-link:hover {
  color: var(--primary-strong);
}
.badge-own {
  background: var(--primary-soft);
  color: var(--primary-strong);
}
.task-desc {
  margin: var(--space-2) 0 0;
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-line;
  word-break: break-word;
  max-width: 65ch;
  /* The full text lives on the task's own page; the row shows a teaser. */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.task-meta {
  margin-top: var(--space-3);
  font-size: 0.82rem;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.due {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.meta-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.no-due {
  opacity: 0.75;
}
.overdue {
  color: var(--danger);
  font-weight: 600;
}
</style>
