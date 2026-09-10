import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../../src/stores/workspace'
import { useLinksStore } from '../../src/stores/links'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('links store', () => {
  async function setupWs() {
    const ws = useWorkspaceStore()
    ws.tree = [
      { name: 'Note.md', path: '/vault/Note.md', isDir: false },
      { name: 'Daily.md', path: '/vault/Daily.md', isDir: false },
    ]
    ws.rootPath = '/vault'
    ws.rootName = 'vault'
    return ws
  }

  it('scans tags and wikilinks from files', async () => {
    const tauri = getTauri()
    tauri.readTextFile.mockImplementation(async (p: string) => {
      if (p === '/vault/Note.md') return '# Note\n内容 #idea 参见 [[Daily]]'
      if (p === '/vault/Daily.md') return '# Daily\n#todo 计划'
      return ''
    })
    await setupWs()
    const links = useLinksStore()
    await links.scanWorkspace()
    const names = links.tagList().map((t) => t.name)
    expect(names).toContain('idea')
    expect(names).toContain('todo')
    expect(links.resolveWikiLink('Daily')).toBe('/vault/Daily.md')
  })

  it('builds backlinks keyed by target name with line + context', async () => {
    const tauri = getTauri()
    tauri.readTextFile.mockImplementation(async (p: string) => {
      if (p === '/vault/Note.md') return 'link to [[Daily]]'
      if (p === '/vault/Daily.md') return 'no links'
      return ''
    })
    await setupWs()
    const links = useLinksStore()
    await links.scanWorkspace()
    const bl = links.getBacklinks('Daily.md')
    expect(bl.length).toBe(1)
    expect(bl[0].fromPath).toBe('/vault/Note.md')
    expect(bl[0].line).toBeGreaterThanOrEqual(1)
    expect(bl[0].context).toContain('Daily')
  })

  it('reset clears scanned data', async () => {
    const tauri = getTauri()
    tauri.readTextFile.mockResolvedValue('# x #t')
    await setupWs()
    const links = useLinksStore()
    await links.scanWorkspace()
    expect(links.tags.size).toBeGreaterThanOrEqual(1)
    links.reset()
    expect(links.tags.size).toBe(0)
    expect(links.backlinks.size).toBe(0)
  })
})
