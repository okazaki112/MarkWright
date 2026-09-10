import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore, joinPath, isReadableFile, parentDirOf } from '../../src/stores/workspace'
import { useWorkspaceActions } from '../../src/composables/useWorkspaceActions'
import { useLinksStore } from '../../src/stores/links'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('workspace store', () => {
  it('joinPath handles separators', () => {
    expect(joinPath('a/b', 'c')).toBe('a/b/c')
    expect(joinPath('C:\\Users', 'file')).toBe('C:\\Users\\file')
  })

  it('setRoot builds a sorted tree (dirs first, then name)', async () => {
    const tauri = getTauri()
    tauri.readDir.mockResolvedValue([
      { name: 'zebra.md', isDirectory: false },
      { name: 'alpha.md', isDirectory: false },
      { name: 'docs', isDirectory: true },
    ])
    const ws = useWorkspaceStore()
    await ws.setRoot('/vault')
    expect(ws.rootPath).toBe('/vault')
    expect(ws.tree[0].name).toBe('docs')
    expect(ws.tree[1].name).toBe('alpha.md')
    expect(ws.tree[2].name).toBe('zebra.md')
  })

  it('skips hidden and ignored entries', async () => {
    const tauri = getTauri()
    tauri.readDir.mockResolvedValue([
      { name: '.git', isDirectory: true },
      { name: 'node_modules', isDirectory: true },
      { name: 'keep.md', isDirectory: false },
    ])
    const ws = useWorkspaceStore()
    await ws.setRoot('/vault')
    expect(ws.tree.map((n) => n.name)).toEqual(['keep.md'])
  })

  it('builds nested tree and findNode locates deep nodes', async () => {
    const tauri = getTauri()
    tauri.readDir.mockImplementation(async (dir: string) => {
      if (dir === '/vault') {
        return [{ name: 'docs', isDirectory: true }]
      }
      if (dir === '/vault/docs') {
        return [{ name: 'a.md', isDirectory: false }]
      }
      return []
    })
    const ws = useWorkspaceStore()
    await ws.setRoot('/vault')
    const node = ws.findNode('/vault/docs/a.md')
    expect(node).toBeTruthy()
    expect(node!.name).toBe('a.md')
  })

  it('toggleSidebar flips visible', () => {
    const ws = useWorkspaceStore()
    const v = ws.visible
    ws.toggleSidebar()
    expect(ws.visible).toBe(!v)
  })

  it('parentDirOf keeps the native separator (Windows)', () => {
    expect(parentDirOf('C:\\vault\\docs\\note.md')).toBe('C:\\vault\\docs')
    expect(parentDirOf('/vault/docs/note.md')).toBe('/vault/docs')
    expect(parentDirOf('a.md')).toBe('a.md')
  })

  it('setFromPath sets the file parent directory as the workspace', async () => {
    const tauri = getTauri()
    tauri.readDir.mockResolvedValue([{ name: 'x.md', isDirectory: false }])
    const ws = useWorkspaceStore()
    const links = useLinksStore()
    vi.spyOn(links, 'scanWorkspace').mockResolvedValue(undefined)
    const actions = useWorkspaceActions()
    const ok = await actions.setFromPath('C:\\vault\\docs\\note.md')
    expect(ok).toBe(true)
    expect(ws.rootPath).toBe('C:\\vault\\docs')
  })
})

describe('isReadableFile', () => {
  it('accepts common text/markup/code extensions', () => {
    expect(isReadableFile('note.md')).toBe(true)
    expect(isReadableFile('readme.txt')).toBe(true)
    expect(isReadableFile('a.MARKDOWN')).toBe(true) // 大小写不敏感
    expect(isReadableFile('data.json')).toBe(true)
    expect(isReadableFile('main.rs')).toBe(true)
    expect(isReadableFile('style.css')).toBe(true)
    expect(isReadableFile('page.vue')).toBe(true)
  })

  it('rejects binary / unreadable extensions', () => {
    expect(isReadableFile('setup.exe')).toBe(false)
    expect(isReadableFile('lib.dll')).toBe(false)
    expect(isReadableFile('app.bin')).toBe(false)
    expect(isReadableFile('photo.png')).toBe(false)
    expect(isReadableFile('doc.pdf')).toBe(false)
  })

  it('handles extensionless text filenames', () => {
    expect(isReadableFile('README')).toBe(true)
    expect(isReadableFile('Makefile')).toBe(true)
    expect(isReadableFile('Dockerfile')).toBe(true)
    expect(isReadableFile('somebinary')).toBe(false) // 无法识别的无扩展名文件
  })
})
