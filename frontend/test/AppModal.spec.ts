import { mountSuspended } from '@nuxt/test-utils/runtime'
import { h } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import AppModal from '~/components/AppModal.vue'

/** Three focusable controls, in document order. */
const withControls = () => [
  h('button', { id: 'one' }, 'One'),
  h('input', { id: 'two' }),
  h('button', { id: 'three' }, 'Three'),
]

const withoutControls = () => [h('p', 'Нечего фокусировать')]

/** AppModal teleports to <body>, so query the document rather than the wrapper. */
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')
const byId = (id: string) => document.getElementById(id)!

function press(key: string, shiftKey = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }))
}

async function openModal(slot = withControls) {
  return mountSuspended(AppModal, {
    props: { title: 'Удалить задачу?' },
    slots: { default: slot },
  })
}

describe('AppModal accessibility', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('is a labelled modal dialog', async () => {
    await openModal()

    const el = dialog()!
    expect(el).not.toBeNull()
    expect(el.getAttribute('aria-modal')).toBe('true')

    // aria-labelledby must point at the real heading.
    const labelId = el.getAttribute('aria-labelledby')!
    expect(labelId).toBeTruthy()
    expect(document.getElementById(labelId)?.textContent).toBe('Удалить задачу?')
  })

  it('moves focus to the first focusable element of the content on open', async () => {
    await openModal()
    // The content field, not the header's close button.
    expect(document.activeElement).toBe(byId('one'))
  })

  it('falls back to the close button when the content holds nothing focusable', async () => {
    await openModal(withoutControls)
    expect(document.activeElement).toBe(document.querySelector('.modal-close'))
  })

  it('closes via the header close button', async () => {
    const wrapper = await openModal()

    document.querySelector<HTMLButtonElement>('.modal-close')!.click()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on Escape', async () => {
    const wrapper = await openModal()

    press('Escape')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes when a click starts and ends on the backdrop', async () => {
    const wrapper = await openModal()
    const overlay = document.querySelector('.overlay')!

    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    overlay.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stays open when a drag starts inside and is released on the backdrop', async () => {
    const wrapper = await openModal()
    const overlay = document.querySelector('.overlay')!

    // Text selection sweeping out of the card: press inside, release outside.
    byId('one').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    overlay.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(wrapper.emitted('close')).toBeUndefined()

    // And the reverse: press on the backdrop, release inside the card.
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    byId('one').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('traps Tab at the end and wraps back to the first element', async () => {
    await openModal()

    byId('three').focus()
    press('Tab')

    // First in document order is the header's close button.
    expect(document.activeElement).toBe(document.querySelector('.modal-close'))
  })

  it('traps Shift+Tab at the start and wraps to the last element', async () => {
    await openModal()

    document.querySelector<HTMLButtonElement>('.modal-close')!.focus()
    press('Tab', true)

    expect(document.activeElement).toBe(byId('three'))
  })

  it('leaves Tab alone in the middle of the dialog', async () => {
    await openModal()

    byId('two').focus()
    press('Tab')

    // Not intercepted — the browser moves focus on its own.
    expect(document.activeElement).toBe(byId('two'))
  })

  it('locks background scrolling while open and restores it on close', async () => {
    const wrapper = await openModal()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('returns focus to whatever opened it', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const wrapper = await openModal()
    expect(document.activeElement).not.toBe(opener)

    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
  })

  it('stops listening for Escape once unmounted', async () => {
    const wrapper = await openModal()
    wrapper.unmount()

    press('Escape')

    expect(wrapper.emitted('close')).toBeUndefined()
  })
})
