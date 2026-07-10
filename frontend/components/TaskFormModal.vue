<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="card modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title" class="modal-title">{{ isEdit ? 'Edit task' : 'New task' }}</h2>

      <div v-if="serverError" class="alert-error modal-alert" role="alert">
        {{ serverError }}
      </div>

      <form novalidate @submit.prevent="submit">
        <div class="field">
          <label for="title">Title *</label>
          <input
            id="title"
            v-model="values.title"
            type="text"
            maxlength="255"
            :aria-invalid="!!errors.title"
          >
          <p v-if="errors.title" class="field-error">{{ errors.title }}</p>
        </div>

        <div class="field">
          <label for="description">Description</label>
          <textarea id="description" v-model="values.description" rows="3" />
          <p v-if="errors.description" class="field-error">{{ errors.description }}</p>
        </div>

        <div class="row">
          <div class="field grow">
            <label for="due_date">Due date</label>
            <input id="due_date" v-model="values.due_date" type="date" :aria-invalid="!!errors.due_date">
            <p v-if="errors.due_date" class="field-error">{{ errors.due_date }}</p>
          </div>

          <div class="field grow">
            <label for="status">Status</label>
            <select id="status" v-model="values.status">
              <option v-for="option in TASK_STATUSES" :key="option" :value="option">
                {{ statusLabel(option) }}
              </option>
            </select>
            <p v-if="errors.status" class="field-error">{{ errors.status }}</p>
          </div>
        </div>

        <div class="actions">
          <button type="button" class="btn-ghost" :disabled="saving" @click="emit('close')">
            Cancel
          </button>
          <button type="submit" class="btn-primary" :disabled="saving">
            <span v-if="saving" class="spinner" />
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Task } from '~/types'
import type { TaskFormValues } from '~/utils/validation'

const props = defineProps<{ task?: Task | null }>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const store = useTasksStore()

const isEdit = computed(() => !!props.task)
const saving = ref(false)
const serverError = ref<string | null>(null)
const errors = reactive<Record<string, string>>({})

const values = reactive<TaskFormValues>({
  title: props.task?.title ?? '',
  description: props.task?.description ?? '',
  due_date: props.task?.due_date ?? '',
  status: props.task?.status ?? 'pending',
})

function replaceErrors(next: Record<string, string> = {}) {
  Object.keys(errors).forEach((key) => delete errors[key])
  Object.assign(errors, next)
}

async function submit() {
  serverError.value = null

  const clientErrors = validateTask(values)
  replaceErrors(clientErrors)
  if (Object.keys(clientErrors).length > 0) return

  saving.value = true

  try {
    const payload = toPayload(values)

    if (props.task) {
      await store.updateTask(props.task.id, payload)
    } else {
      await store.createTask(payload)
    }

    emit('saved')
  } catch (e) {
    // Map the backend's 422 field errors back onto the form.
    const body = apiError(e)

    if (body?.errors) {
      replaceErrors(
        Object.fromEntries(
          Object.entries(body.errors).map(([field, messages]) => [field, messages[0] as string]),
        ),
      )
    }

    serverError.value = body?.message ?? 'Could not save the task. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(16, 24, 40, 0.45);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 4rem 1rem;
  z-index: 50;
  overflow-y: auto;
}
.modal {
  width: 100%;
  max-width: 480px;
  padding: 1.5rem;
}
.modal-title {
  margin: 0 0 1.25rem;
}
.modal-alert {
  margin-bottom: 1rem;
}
.row {
  display: flex;
  gap: 1rem;
}
.grow {
  flex: 1;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.5rem;
}
@media (max-width: 480px) {
  .row {
    flex-direction: column;
    gap: 0;
  }
}
</style>
