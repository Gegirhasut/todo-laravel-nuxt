<template>
  <div class="task-row card">
    <div class="task-main">
      <div class="task-head">
        <span class="task-title" :class="{ done: task.status === 'completed' }">
          {{ task.title }}
        </span>
        <span class="badge" :class="`badge-${task.status}`">{{ statusLabel(task.status) }}</span>
      </div>

      <p v-if="task.description" class="task-desc muted">{{ task.description }}</p>

      <div class="task-meta muted">
        <span :class="{ overdue: isOverdue(task.due_date, task.status) }">
          Due: {{ formatDate(task.due_date) }}
        </span>
        <span v-if="showOwner && task.owner"> · {{ task.owner.name }}</span>
      </div>
    </div>

    <!-- Hidden entirely when the current user may not act on this task. -->
    <div v-if="canManage" class="task-actions">
      <button class="btn-ghost btn-sm" @click="emit('edit', task)">Edit</button>
      <button class="btn-danger btn-sm" @click="emit('delete', task)">Delete</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '~/types'

const props = defineProps<{ task: Task }>()

const emit = defineEmits<{
  edit: [task: Task]
  delete: [task: Task]
}>()

const auth = useAuthStore()

// Mirrors TaskPolicy on the backend: admins manage everything, everyone else
// only their own tasks.
const canManage = computed(() => auth.isAdmin || props.task.user_id === auth.user?.id)

// The owner's name is only interesting to an admin, who sees other people's tasks.
const showOwner = computed(() => auth.isAdmin)
</script>

<style scoped>
.task-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
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
