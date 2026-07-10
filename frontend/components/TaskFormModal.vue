<template>
  <AppModal :title="isEdit ? 'Редактирование задачи' : 'Новая задача'" @close="emit('close')">
    <div v-if="serverError" class="alert-error modal-alert" role="alert">
      {{ serverError }}
    </div>

    <form novalidate @submit.prevent="submit">
      <div class="field">
        <label for="title">Название *</label>
        <input
          id="title"
          v-model="values.title"
          type="text"
          maxlength="255"
          required
          :aria-invalid="!!errors.title"
          :aria-describedby="errors.title ? 'title-error' : undefined"
        >
        <p v-if="errors.title" id="title-error" class="field-error">{{ errors.title }}</p>
      </div>

      <div class="field">
        <label for="description">Описание</label>
        <textarea
          id="description"
          v-model="values.description"
          rows="3"
          :aria-describedby="errors.description ? 'description-error' : undefined"
        />
        <p v-if="errors.description" id="description-error" class="field-error">
          {{ errors.description }}
        </p>
      </div>

      <div class="row">
        <div class="field grow">
          <label for="due_date">Срок</label>
          <input
            id="due_date"
            v-model="values.due_date"
            type="date"
            :aria-invalid="!!errors.due_date"
            :aria-describedby="errors.due_date ? 'due-date-error' : undefined"
          >
          <p v-if="errors.due_date" id="due-date-error" class="field-error">{{ errors.due_date }}</p>
        </div>

        <div class="field grow">
          <label for="status">Статус</label>
          <select
            id="status"
            v-model="values.status"
            :aria-invalid="!!errors.status"
            :aria-describedby="errors.status ? 'status-error' : undefined"
          >
            <option v-for="option in TASK_STATUSES" :key="option" :value="option">
              {{ statusLabel(option) }}
            </option>
          </select>
          <p v-if="errors.status" id="status-error" class="field-error">{{ errors.status }}</p>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn-ghost" :disabled="saving" @click="emit('close')">
          Отмена
        </button>
        <button type="submit" class="btn-primary" :disabled="saving">
          <span v-if="saving" class="spinner" aria-hidden="true" />
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

<script setup lang="ts">
import type { Task } from '~/types'
import type { TaskFormValues } from '~/utils/validation'

const props = defineProps<{ task?: Task | null }>()

const emit = defineEmits<{
  close: []
  saved: [task: Task]
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

    const saved = props.task
      ? await store.updateTask(props.task.id, payload)
      : await store.createTask(payload)

    emit('saved', saved)
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

    serverError.value = body?.message ?? 'Не удалось сохранить задачу. Попробуйте ещё раз.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
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
