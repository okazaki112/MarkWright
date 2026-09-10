import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '../../src/stores/theme'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('theme store', () => {
  it('ships builtin themes', () => {
    const t = useThemeStore()
    expect(t.themes.length).toBeGreaterThanOrEqual(6)
    expect(t.current()).toBeTruthy()
  })

  it('applies a theme by setting data attributes', () => {
    const t = useThemeStore()
    t.setTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    const light = t.themes.find((x) => !x.isDark)
    expect(light).toBeTruthy()
    if (light) {
      t.setTheme(light.id)
      expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    }
  })

  it('nextTheme cycles through themes', () => {
    const t = useThemeStore()
    const before = t.currentId
    t.nextTheme()
    expect(t.currentId).not.toBe(before)
  })
})
