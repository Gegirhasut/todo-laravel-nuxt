<template>
  <!-- Rendered at the end of <body> so assistive tech is not walking the
       dimmed page content to reach the dialog. -->
  <Teleport to="body">
    <div class="overlay" @mousedown="onBackdropDown" @mouseup="onBackdropUp">
      <div
        ref="dialog"
        class="card modal"
        :class="size"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
      >
        <!-- The header stays pinned; only the body scrolls. -->
        <header class="modal-head">
          <h2 :id="titleId" class="modal-title">{{ title }}</h2>
          <button type="button" class="modal-close" aria-label="Закрыть" @click="emit('close')">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div class="modal-body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    size?: 'narrow' | 'wide'
    /** Off while the content holds unsaved edits a stray click would lose. */
    backdropClose?: boolean
  }>(),
  { size: 'wide', backdropClose: true },
)

const emit = defineEmits<{ close: [] }>()

const titleId = useId()
const dialog = ref<HTMLElement | null>(null)

// Close on a backdrop click only when the interaction both STARTED and ENDED
// on the backdrop itself. A `click.self` would also fire after a text
// selection that starts inside the card and is released over the backdrop —
// the browser targets such a click at the common ancestor — silently closing
// the dialog mid-selection.
let pressedOnBackdrop = false

function onBackdropDown(event: MouseEvent) {
  pressedOnBackdrop = event.target === event.currentTarget
}

function onBackdropUp(event: MouseEvent) {
  if (props.backdropClose && pressedOnBackdrop && event.target === event.currentTarget) emit('close')
  pressedOnBackdrop = false
}

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
  // Land on the first field of the content, not on the header's close button;
  // fall back to the close button, then the dialog itself.
  const items = focusable()
  const inBody = items.find((el) => el.closest('.modal-body'))
  ;(inBody ?? items[0] ?? dialog.value)?.focus()
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
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  z-index: 50;
}
.modal {
  width: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.modal:focus {
  outline: none;
}
.modal.wide {
  width: min(920px, 92vw);
  max-width: 100%;
}
.modal.narrow {
  max-width: 400px;
}
.modal-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--card-pad);
  border-bottom: 1px solid var(--border);
}
.modal-close {
  display: flex;
  padding: var(--space-1);
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  border-radius: var(--radius-sm);
  transition: background 0.15s ease, color 0.15s ease;
}
.modal-close:hover {
  color: var(--text);
  background: var(--surface-hover);
}
.modal-close svg {
  width: 18px;
  height: 18px;
}
.modal-title {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.35;
  /* A long task title must never push the dialog apart. */
  overflow-wrap: break-word;
}
.modal-body {
  overflow-y: auto;
  padding: var(--card-pad);
}
@media (max-width: 480px) {
  .overlay {
    padding: var(--space-3);
  }
  .modal {
    max-height: 92vh;
  }
}
</style>
