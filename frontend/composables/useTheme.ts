export type Theme = 'light' | 'dark'

/**
 * Light/dark theme switch. The choice is persisted in a cookie; without one
 * the OS preference (prefers-color-scheme) decides. The palette itself lives
 * in assets/css/main.css — this only flips `data-theme` on <html>.
 */
export function useTheme() {
  const cookie = useCookie<Theme | null>('theme', {
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })

  const theme = useState<Theme>('theme', () => {
    if (cookie.value === 'light' || cookie.value === 'dark') return cookie.value

    return import.meta.client && window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  function apply() {
    if (import.meta.client) document.documentElement.dataset.theme = theme.value
  }

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    cookie.value = theme.value
    apply()
  }

  return { theme, toggle, apply }
}
