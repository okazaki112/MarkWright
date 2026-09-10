import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentStore } from '../../src/stores/document'
import { useUIStore } from '../../src/stores/ui'
import { useSessionStore } from '../../src/stores/session'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('session store', () => {
  it('save writes a JSON session file', async () => {
    const tauri = getTauri()
    let written = ''
    tauri.writeTextFile.mockImplementation(async (_p: string, c: string) => {
      written = c
    })
    tauri.appDataDir.mockResolvedValue('/appdata')
    tauri.join.mockImplementation((...p: string[]) => p.join('/'))

    const doc = useDocumentStore()
    doc.loadFromPath('/vault/note.md', 'hi')
    const ui = useUIStore()
    ui.setViewMode('preview')
    const session = useSessionStore()
    await session.save()
    const state = JSON.parse(written)
    expect(state.workspacePath).toBeNull()
    expect(state.openFilePaths).toContain('/vault/note.md')
    expect(state.viewMode).toBe('preview')
    expect(session.lastSavedAt).toBeGreaterThan(0)
  })

  it('restore re-applies UI but does NOT reopen historical tabs', async () => {
    const tauri = getTauri()
    tauri.appDataDir.mockResolvedValue('/appdata')
    tauri.join.mockImplementation((...p: string[]) => p.join('/'))
    tauri.exists.mockResolvedValue(true)
    tauri.readTextFile.mockImplementation(async (p: string) => {
      if (String(p).endsWith('session.json')) {
        return JSON.stringify({
          workspacePath: null,
          openFilePaths: ['/vault/note.md'],
          activePath: '/vault/note.md',
          splitRatio: 0.6,
          viewMode: 'editor',
          sidebarOpen: false,
          scrollSync: false,
          themeId: 'dark',
        })
      }
      if (p === '/vault/note.md') return '# 恢复的内容'
      return ''
    })

    const session = useSessionStore()
    const ok = await session.restore()
    expect(ok).toBe(true)
    const doc = useDocumentStore()
    // 历史标签不应被恢复：重启后只保留默认欢迎页，由关联打开的文件接管
    expect(doc.tabs.some((t) => t.path === '/vault/note.md')).toBe(false)
    const ui = useUIStore()
    expect(ui.viewMode).toBe('editor')
    expect(ui.splitRatio).toBe(0.6)
  })
})
