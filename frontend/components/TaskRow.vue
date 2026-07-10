<template>
  <article class="task-row card" :class="{ highlighted }">
    <div class="task-main">
      <div class="task-head">
        <h2 class="task-title" :class="{ done: task.status === 'completed' }">
          {{ task.title }}
        </h2>
        <span class="badge" :class="`badge-${task.status}`">{{ statusLabel(task.status) }}</span>

        <!-- Only worth saying when the list also holds other people's tasks. -->
        <span v-if="showOwner && isOwn" class="badge badge-own">Моя</span>
      </div>

      <p v-if="task.description" class="task-desc muted">{{ task.description }}</p>

      <div class="task-meta muted">
        <span :class="{ overdue: isOverdue(task.due_date, task.status) }">
          Срок: {{ formatDate(task.due_date) }}
        </span>
        <!-- The «Моя» badge already says whose it is, so don't repeat the name. -->
        <span v-if="showOwner && !isOwn && task.owner"> · {{ task.owner.name }}</span>
      </div>
    </div>

    <!-- Hidden entirely when the current user may not act on this task. -->
    <div v-if="canManage" class="task-actions">
      <!-- The visible label repeats across rows, so name the task for screen readers. -->
      <button
        class="btn-ghost btn-sm"
        :aria-label="`Изменить задачу «${task.title}»`"
        @click="emit('edit', task)"
      >
        Изменить
      </button>
      <button
        class="btn-danger btn-sm"
        :aria-label="`Удалить задачу «${task.title}»`"
        @click="emit('delete', task)"
      >
        Удалить
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

const props = withDefaults(
  defineProps<{
    task: Task
    /** Briefly flashes a task that was just added, so it is easy to spot. */
    highlighted?: boolean
    /** True when the list mixes several owners, i.e. admin or ?scope=all. */
    showOwner?: boolean
  }>(),
  { highlighted: false, showOwner: false },
)

const emit = defineEmits<{
  edit: [task: Task]
  delete: [task: Task]
}>()

const auth = useAuthStore()

const isOwn = computed(() => props.task.user_id === auth.user?.id)

// Mirrors TaskPolicy on the backend: admins manage everything, everyone else
// only their own tasks.
const canManage = computed(() => auth.isAdmin || isOwn.value)
</script>

<style scoped>
.task-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
}
.task-row.highlighted {
  border-color: var(--success);
  animation: flash 2s ease-out;
}
@keyframes flash {
  0%,
  35% {
    background: #ebfbee;
    box-shadow: 0 0 0 3px rgba(47, 158, 68, 0.18);
  }
  100% {
    background: var(--surface);
    box-shadow: var(--shadow);
  }
}
@media (prefers-reduced-motion: reduce) {
  .task-row.highlighted {
    animation: none;
    background: #ebfbee;
  }
}
.badge-own {
  background: #eef2ff;
  color: var(--primary);
}
.task-main {
  min-width: 0;
}
.task-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.task-title {
  font-weight: 600;
  font-size: 1rem;
  margin: 0;
}
.task-title.done {
  text-decoration: line-through;
  color: var(--muted);
}
.task-desc {
  margin: 0.4rem 0 0;
  font-size: 0.9rem;
  white-space: pre-wrap;
  word-break: break-word;
}
.task-meta {
  margin-top: 0.5rem;
  font-size: 0.82rem;
}
.overdue {
  color: var(--danger);
  font-weight: 600;
}
.task-actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}
</style>
