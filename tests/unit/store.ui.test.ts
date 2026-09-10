import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUIStore, SIDEBAR_MIN_W, SIDEBAR_MAX_W, SIDEBAR_DEFAULT_W } from '../../src/stores/ui'

beforeEach(() => setActivePinia(createPinia()))

describe('ui store', () => {
  it('exposes sidebar boundaries', () => {
    expect(SIDEBAR_MIN_W).toBe(200)
    expect(SIDEBAR_MAX_W).toBe(560)
    expect(SIDEBAR_DEFAULT_W).toBe(300)
  })

  it('clamps sidebar width', () => {
    const ui = useUIStore()
    ui.setSidebarWidth(10)
    expect(ui.sidebarWidth).toBe(SIDEBAR_MIN_W)
    ui.setSidebarWidth(9999)
    expect(ui.sidebarWidth).toBe(SIDEBAR_MAX_W)
    ui.setSidebarWidth(400)
    expect(ui.sidebarWidth).toBe(400)
  })

  it('resets sidebar width to default', () => {
    const ui = useUIStore()
    ui.setSidebarWidth(450)
    ui.resetSidebarWidth()
    expect(ui.sidebarWidth).toBe(SIDEBAR_DEFAULT_W)
  })

  it('clamps split ratio between 0.2 and 0.8', () => {
    const ui = useUIStore()
    ui.setSplitRatio(0.01)
    expect(ui.splitRatio).toBe(0.2)
    ui.setSplitRatio(0.99)
    expect(ui.splitRatio).toBe(0.8)
  })

  it('toggles view mode / scroll sync / sidebar', () => {
    const ui = useUIStore()
    ui.setViewMode('preview')
    expect(ui.viewMode).toBe('preview')
    ui.toggleScrollSync()
    expect(ui.scrollSync).toBe(false)
    ui.toggleSidebar()
    expect(ui.sidebarOpen).toBe(false)
  })

  it('toggles auto save and interval', () => {
    const ui = useUIStore()
    ui.setAutoSave(false)
    expect(ui.autoSaveEnabled).toBe(false)
    ui.setAutoSaveInterval(5000)
    expect(ui.autoSaveInterval).toBe(5000)
  })
})
