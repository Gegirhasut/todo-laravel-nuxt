<template>
  <!-- Opened from the list: a dialog stacked over it. While the delete
       confirmation is up, this one steps aside so only a single focus trap
       is ever active. -->
  <AppModal
    v-if="overlay && !deleting"
    :title="dialogTitle"
    :backdrop-close="!formActive"
    @close="close"
  >
    <TaskDetail
      :task="task"
      :mode="createMode ? 'create' : 'view'"
      :pending="pending"
      :error="error"
      @saved="onSaved"
      @created="onCreated"
      @cancel-create="close"
      @delete="askDelete"
      @retry="load"
      @editing-change="detailEditing = $event"
    />
  </AppModal>

  <!-- Opened directly (shared link, new tab, refresh): a standalone page. -->
  <div v-else-if="!overlay" class="container">
    <div class="detail-page">
      <NuxtLink to="/" class="back-link">← К списку</NuxtLink>
      <h1 v-if="createMode" class="create-title">Новая задача</h1>
    </div>

    <div class="card detail-card">
      <TaskDetail
        :task="task"
        :mode="createMode ? 'create' : 'view'"
        :pending="pending"
        :error="error"
        @saved="onSaved"
        @created="onCreated"
        @cancel-create="close"
        @delete="askDelete"
        @retry="load"
        @editing-change="detailEditing = $event"
      />
    </div>
  </div>

  <LazyConfirmDialog
    v-if="deleting && task"
    title="Удалить задачу?"
    :message="`«${task.title}» будет удалена безвозвратно.`"
    :busy="deleteBusy"
    :error="deleteError"
    @confirm="confirmDelete"
    @cancel="deleting = false"
  />
</template>

<script setup lang="ts">
import type { Task } from '~/types'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const router = useRouter()
const store = useTasksStore()
const toasts = useToastsStore()

// The list sets this right before pushing the route, so an in-app click gets
// the overlay. A direct load (shared link, new tab, refresh) starts from the
// default and renders the standalone page instead.
const overlayFlag = useState('task-detail-overlay', () => false)
const overlay = overlayFlag.value

// Tells the list to re-sync itself after a create or delete.
const listStale = useState('tasks-list-stale', () => false)

onBeforeUnmount(() => {
  overlayFlag.value = false
})

/** /tasks/new — the same card, empty and editable. */
const createMode = computed(() => route.params.id === 'new')

const task = ref<Task | null>(null)
const pending = ref(false)
const error = ref<'forbidden' | 'notfound' | 'other' | null>(null)

// The card shows the (editable) title itself, so the dialog header stays
// generic instead of duplicating it.
const dialogTitle = computed(() => (createMode.value ? 'Новая задача' : 'Задача'))

// While the card is a form (create, or edit turned on), a stray click on the
// dialog backdrop must not throw the edits away.
const detailEditing = ref(false)
const formActive = computed(() => createMode.value || detailEditing.value)

async function load() {
  if (createMode.value) return

  const id = Number(route.params.id)
  // Right after a create we already hold the fresh task — no point refetching.
  if (task.value?.id === id) return

  pending.value = true
  error.value = null

  try {
    task.value = await store.fetchTask(id)
  } catch (e) {
    const status = (e as { status?: number }).status
    error.value = status === 403 ? 'forbidden' : status === 404 ? 'notfound' : 'other'
  } finally {
    pending.value = false
  }
}

watch(
  () => route.params.id,
  (id) => {
    // The watcher also fires while navigating away, when the param is gone.
    if (id) load()
  },
  { immediate: true },
)

/** In overlay mode there is always an in-app entry to return to — the list. */
function close() {
  if (overlay) router.back()
  else navigateTo('/')
}

function onSaved(updated: Task) {
  task.value = updated
  toasts.success('Задача обновлена.')
}

function onCreated(created: Task) {
  task.value = created
  listStale.value = true
  toasts.success('Задача создана.')

  // Swap /tasks/new for the real address; the card flips into read mode.
  router.replace(`/tasks/${created.id}`)
}

// --- Delete ------------------------------------------------------------
const deleting = ref(false)
const deleteBusy = ref(false)
const deleteError = ref<string | null>(null)

function askDelete() {
  deleteError.value = null
  deleting.value = true
}

async function confirmDelete() {
  if (!task.value) return

  deleteBusy.value = true
  deleteError.value = null

  try {
    const message = await store.deleteTask(task.value.id)
    deleting.value = false
    listStale.value = true
    toasts.success(message)
    await navigateTo('/')
  } catch (e) {
    deleteError.value = apiErrorMessage(e, 'Не удалось удалить задачу.')
  } finally {
    deleteBusy.value = false
  }
}
</script>

<style scoped>
.detail-page {
  width: min(920px, 92vw);
  margin: 0 auto;
}
.back-link {
  display: inline-block;
  margin-bottom: var(--space-4);
  font-size: 0.9rem;
}
.detail-card {
  /* A genuinely wide card on any screen, with the header context above and
     internal scroll instead of a growing page. */
  width: min(920px, 92vw);
  max-width: 100%;
  margin: 0 auto;
  padding: var(--card-pad);
  max-height: 85vh;
  overflow-y: auto;
}
.create-title {
  margin: 0 0 var(--space-4);
  font-size: 1.4rem;
  line-height: 1.3;
}
@media (max-width: 480px) {
  .detail-card {
    padding: var(--space-5);
  }
}
</style>
