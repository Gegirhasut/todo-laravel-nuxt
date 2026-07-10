<template>
  <div class="task-detail">
    <div v-if="pending" class="state" role="status">
      <span class="spinner spinner-dark" aria-hidden="true" /> Загрузка задачи…
    </div>

    <div v-else-if="error === 'forbidden'" class="state" role="alert">
      Нет доступа к этой задаче.
    </div>

    <div v-else-if="error === 'notfound'" class="state" role="alert">
      Задача не найдена.
    </div>

    <div v-else-if="error" class="alert-error" role="alert">
      Не удалось загрузить задачу.
      <button class="btn-ghost btn-sm retry" @click="emit('retry')">Повторить</button>
    </div>

    <!-- Two clean modes on one skeleton. READ is a plain document: text
         selects and copies like text, nothing edits on click. «Изменить»
         (or /tasks/new) flips the same slots into a full form — every field
         shares its .control box with the read value, so the card does not
         move between modes. -->
    <component
      :is="isForm ? 'form' : 'div'"
      v-else-if="isForm || task"
      class="detail-main"
      novalidate
      @submit.prevent="onSubmit"
    >
      <div class="head-row">
        <div class="title-slot" :style="isForm ? titleSlotStyle : undefined">
          <template v-if="isForm">
            <label :for="`${uid}-title`" class="sr-only">Название *</label>
            <input
              :id="`${uid}-title`"
              ref="titleInput"
              v-model="values.title"
              type="text"
              class="control control-title is-editing"
              maxlength="255"
              required
              placeholder="Название задачи"
              :aria-invalid="!!errors.title"
              :aria-describedby="errors.title ? `${uid}-title-error` : undefined"
            >
            <p v-if="errors.title" :id="`${uid}-title-error`" class="field-error">{{ errors.title }}</p>
          </template>

          <!-- No strikethrough here, unlike the list rows: there is nothing
               to scan on a single-task page, a struck long title is just
               harder to read, and the badge already says «Выполнено». -->
          <h1 v-else ref="titleRead" class="detail-title">
            <span class="control control-title">{{ t.title }}</span>
          </h1>
        </div>

        <div class="status-slot">
          <template v-if="isForm">
            <label :for="`${uid}-status`" class="sr-only">Статус</label>
            <select :id="`${uid}-status`" v-model="values.status">
              <option v-for="option in TASK_STATUSES" :key="option" :value="option">
                {{ statusLabel(option) }}
              </option>
            </select>
          </template>

          <span v-else class="badge" :class="`badge-${t.status}`">{{ statusLabel(t.status) }}</span>
        </div>
      </div>

      <dl class="detail-meta">
        <div class="meta-item meta-due">
          <dt>Срок</dt>
          <dd :class="{ overdue: !isForm && task && isOverdue(t.due_date, t.status) }">
            <template v-if="isForm">
              <label :for="`${uid}-due`" class="sr-only">Срок</label>
              <input
                :id="`${uid}-due`"
                v-model="values.due_date"
                type="date"
                class="control control-due is-editing"
                :aria-invalid="!!errors.due_date"
                :aria-describedby="errors.due_date ? `${uid}-due-error` : undefined"
              >
              <p v-if="errors.due_date" :id="`${uid}-due-error`" class="field-error">{{ errors.due_date }}</p>
            </template>

            <span v-else class="control control-due">
              <template v-if="t.due_date">{{ formatDate(t.due_date) }}</template>
              <span v-else class="muted">Без срока</span>
            </span>
          </dd>
        </div>

        <!-- Owner is only interesting on the admin's mixed list; never the email. -->
        <div v-if="!isCreating && auth.isAdmin && t.owner" class="meta-item">
          <dt>Владелец</dt>
          <dd>{{ t.owner.name }}</dd>
        </div>

        <div v-if="!isCreating" class="meta-item">
          <dt>Создана</dt>
          <dd>{{ formatDate(t.created_at) }}</dd>
        </div>
      </dl>

      <div class="desc-area">
        <div class="area-label">Описание</div>

        <template v-if="isForm">
          <label :for="`${uid}-description`" class="sr-only">Описание</label>
          <textarea
            :id="`${uid}-description`"
            v-model="values.description"
            class="control control-desc is-editing"
            :style="descStyle"
            :aria-invalid="!!errors.description"
            :aria-describedby="errors.description ? `${uid}-description-error` : undefined"
          />
          <p v-if="errors.description" :id="`${uid}-description-error`" class="field-error">
            {{ errors.description }}
          </p>
        </template>

        <p v-else ref="descRead" class="control control-desc">
          <template v-if="t.description">{{ t.description }}</template>
          <span v-else class="muted desc-empty">Без описания.</span>
        </p>
      </div>

      <!-- One footer bar, always in the same place with the same height:
           edit actions on the left, the destructive one on the right. -->
      <div v-if="isForm" class="detail-actions">
        <button type="submit" class="btn-primary" :disabled="saving">
          <span v-if="saving" class="spinner" aria-hidden="true" />
          {{ saving ? 'Сохранение…' : 'Сохранить' }}
        </button>
        <button type="button" class="btn-ghost" :disabled="saving" @click="onCancel">
          Отмена
        </button>
        <p v-if="serverError" class="field-error footer-error" role="alert">{{ serverError }}</p>

        <button
          v-if="!isCreating && canManage"
          type="button"
          class="btn-danger delete-btn"
          :disabled="saving"
          @click="emit('delete', t)"
        >
          Удалить
        </button>
      </div>
      <div v-else-if="canManage" class="detail-actions">
        <button ref="editButton" type="button" class="btn-ghost" @click="startEditing">
          Изменить
        </button>
        <button type="button" class="btn-danger delete-btn" @click="emit('delete', t)">
          Удалить
        </button>
      </div>
    </component>
  </div>
</template>

<script setup lang="ts">
import type { Task, TaskPayload } from '~/types'

const props = withDefaults(
  defineProps<{
    task: Task | null
    /** `create` renders the same card with the form permanently open. */
    mode?: 'view' | 'create'
    pending?: boolean
    error?: 'forbidden' | 'notfound' | 'other' | null
  }>(),
  { mode: 'view', pending: false, error: null },
)

const emit = defineEmits<{
  saved: [task: Task]
  created: [task: Task]
  cancelCreate: []
  delete: [task: Task]
  retry: []
  /** The dialog around the card ignores backdrop clicks while this is true. */
  editingChange: [editing: boolean]
}>()

const auth = useAuthStore()
const store = useTasksStore()
const uid = useId()

/** Only read inside branches that render when the task exists. */
const t = computed(() => props.task as Task)

// Mirrors TaskPolicy: admins manage everything, others only their own tasks.
const canManage = computed(
  () => auth.isAdmin || (!!props.task && props.task.user_id === auth.user?.id),
)

// --- The two modes -----------------------------------------------------------
const isCreating = computed(() => props.mode === 'create' && !props.pending && !props.error)

/** View-mode editing; only the footer «Изменить» button turns it on. */
const editing = ref(false)

const isForm = computed(() => isCreating.value || editing.value)

// One form for create AND edit: the getter seeds from the current task, so
// reset() re-fills it each time editing starts.
const { values, errors, serverError, saving, submit, reset } = useTaskForm(() => ({
  title: props.task?.title ?? '',
  description: props.task?.description ?? '',
  due_date: props.task?.due_date ?? '',
  status: props.task?.status ?? 'pending',
}))

const titleInput = ref<HTMLInputElement | null>(null)
const editButton = ref<HTMLButtonElement | null>(null)
const titleRead = ref<HTMLElement | null>(null)
const descRead = ref<HTMLElement | null>(null)

// The editors inherit the height of the read content they replace, so a
// wrapped title or a long description flips into the form without a jump.
const titleHeight = ref(0)
const descHeight = ref(0)
const DESC_MIN_HEIGHT = 300

const titleSlotStyle = computed(() =>
  titleHeight.value ? { minHeight: `${titleHeight.value}px` } : undefined,
)
const descStyle = computed(() =>
  descHeight.value ? { height: `${descHeight.value}px` } : undefined,
)

function startEditing() {
  if (!props.task) return

  titleHeight.value = titleRead.value?.offsetHeight ?? 0
  descHeight.value = Math.max(DESC_MIN_HEIGHT, descRead.value?.offsetHeight ?? 0)

  reset()
  editing.value = true
  emit('editingChange', true)

  nextTick(() => {
    // The «Изменить» button sits at the card's bottom; on a long card the
    // form's top may be far above the fold, so this one deliberate scroll
    // reveals it — in the overlay that scrolls the modal body, standalone
    // the card and page. The focus itself must not scroll, or the browser's
    // default focus-scroll would fight the smooth animation.
    titleInput.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    titleInput.value?.focus({ preventScroll: true })
  })
}

function stopEditing() {
  editing.value = false
  emit('editingChange', false)
  nextTick(() => editButton.value?.focus({ preventScroll: true }))
}

function onCancel() {
  if (isCreating.value) emit('cancelCreate')
  else stopEditing()
}

function onSubmit() {
  if (isForm.value) save()
}

async function save() {
  const action = isCreating.value
    ? (payload: TaskPayload) => store.createTask(payload)
    : (payload: TaskPayload) => store.updateTask(t.value.id, payload)

  const result = await submit(action)
  if (!result) return // validation or API errors are already on the fields

  if (isCreating.value) {
    emit('created', result)
    return
  }

  emit('saved', result)
  stopEditing()
}

// While editing, Esc cancels the edit — never the dialog around it. The
// capture-phase listener runs before the dialog's own Escape handling and
// stops the event there. In create mode Esc keeps closing the dialog.
function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !editing.value) return
  event.preventDefault()
  event.stopPropagation()
  stopEditing()
}

onMounted(() => {
  document.addEventListener('keydown', onEscape, true)
  if (props.mode === 'create') nextTick(() => titleInput.value?.focus({ preventScroll: true }))
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onEscape, true)
})
</script>

<style scoped>
.task-detail {
  /* The one type scale for every state. Read and form draw from these
     variables, so switching modes can never change a font. */
  --fs-title: 1.45rem;
  --lh-title: 1.35;
  --fs-body: 0.95rem;
  --lh-body: 1.65;
  --fs-label: 0.72rem;
  --pad-x: 0.5rem;
  --pad-y: 0.3rem;
}

.state {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--muted);
  padding: var(--space-5) 0;
  justify-content: center;
}
.retry {
  margin-left: var(--space-3);
}

/* --- The shared field box -------------------------------------------------- */
/* A field's read value and its form control are the same box: same font,
   same padding, same 1px border — transparent in read, visible in the form.
   Flipping modes therefore swaps chrome, not geometry. */
.control {
  display: block;
  font: inherit;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: var(--pad-y) var(--pad-x);
  margin: 0 0 0 calc(-1 * var(--pad-x));
  width: calc(100% + 2 * var(--pad-x));
}
.control.is-editing {
  background: var(--surface);
  border-color: var(--border);
  color: var(--text);
}
.control.is-editing:focus {
  outline: 2px solid var(--focus-soft);
  border-color: var(--primary);
}

/* --- Head: title + status --------------------------------------------------- */
.head-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: var(--space-4);
  align-items: start;
}
.title-slot {
  min-width: 0;
}
.detail-title {
  margin: 0;
  font-size: var(--fs-title);
  line-height: var(--lh-title);
  font-weight: 600;
}
.control-title {
  font-size: var(--fs-title);
  line-height: var(--lh-title);
  font-weight: 600;
  overflow-wrap: break-word;
}
/* Tall enough for both the badge and the form's select, so the head row
   keeps one height across modes. */
.status-slot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 2.75rem;
}
.status-slot select {
  width: 11rem;
}

/* --- Meta row ---------------------------------------------------------------- */
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
  margin: var(--space-4) 0 0;
}
.meta-item dt {
  font-size: var(--fs-label);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: 2px;
}
.meta-item dd {
  margin: 0;
  min-height: 2.2rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  font-size: var(--fs-body);
}
/* Wide enough for the date editor, so the form pushes nothing sideways. */
.meta-due {
  min-width: 15rem;
}
.meta-item dd .field-error {
  width: 100%;
}
.overdue {
  color: var(--danger);
  font-weight: 600;
}
.control-due {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  width: auto;
  height: 2.2rem;
  font-size: var(--fs-body);
  white-space: nowrap;
}
input.control-due {
  width: 11.5rem;
}

/* --- Description ---------------------------------------------------------------- */
.desc-area {
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
}
.area-label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--fs-label);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin-bottom: var(--space-2);
}
.control-desc {
  /* Roomier box than the one-line fields: this is where people write. */
  --pad-x: 0.75rem;
  --pad-y: 0.65rem;
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  min-height: 300px;
  white-space: pre-line;
  overflow-wrap: break-word;
}
textarea.control-desc {
  white-space: pre-wrap;
  resize: vertical;
}
.desc-empty {
  font-style: italic;
}

/* --- Footer bar ------------------------------------------------------------------------ */
/* The one action bar of the card. Its height never changes between read and
   edit, so switching modes moves nothing above it. */
.detail-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  min-height: 2.6rem;
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
}
.delete-btn {
  margin-left: auto;
}
.footer-error {
  margin: 0 0 0 var(--space-2);
}
</style>
