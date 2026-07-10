<template>
  <!-- Rendered at the end of <body> so assistive tech is not walking the
       dimmed page content to reach the dialog. -->
  <Teleport to="body">
    <div class="overlay" @click.self="emit('close')">
      <div
        ref="dialog"
        class="card modal"
        :class="size"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <h2 :id="titleId" class="modal-title">{{ title }}</h2>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    size?: 'narrow' | 'wide'
  }>(),
  { size: 'wide' },
)

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const dialog = ref<HTMLElement | null>(null)

/** Everything the user can tab to inside the dialog, in document order. */
function focusable(): HTMLElement[] {
  if (!dialog.value) return []

  return Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true')
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    return
  }

  if (event.key !== 'Tab') return

  // Keep Tab and Shift+Tab cycling inside the dialog.
  const items = focusable()
  if (items.length === 0) {
    event.preventDefault()
    dialog.value?.focus()
    return
  }

  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement

  if (event.shiftKey && (active === first || active === dialog.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

let previouslyFocused: HTMLElement | null = null

onMounted(async () => {
  previouslyFocused = document.activeElement as HTMLElement | null

  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'

  await nextTick()
  // Land on the first field rather than on the dialog itself when there is one.
  ;(focusable()[0] ?? dialog.value)?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''

  // Send focus back to whatever opened the dialog.
  previouslyFocused?.focus?.()
})
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
  padding: 1.5rem;
}
.modal:focus {
  outline: none;
}
.modal.wide {
  max-width: 480px;
}
.modal.narrow {
  max-width: 380px;
}
.modal-title {
  margin: 0 0 1.25rem;
  font-size: 1.3rem;
}
@media (max-width: 480px) {
  .overlay {
    padding: 1.5rem 1rem;
  }
}
</style>
