import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentStore } from '../../src/stores/document'

beforeEach(() => setActivePinia(createPinia()))

describe('document store', () => {
  it('starts with a default tab', () => {
    const doc = useDocumentStore()
    expect(doc.tabs).toHaveLength(1)
    expect(doc.activeTab).not.toBeNull()
    expect(doc.isDirty).toBe(false)
  })

  it('creates a new document and activates it', () => {
    const doc = useDocumentStore()
    const first = doc.activeId
    const t = doc.newDocument()
    expect(doc.tabs).toHaveLength(2)
    expect(doc.activeId).toBe(t.id)
    expect(doc.activeId).not.toBe(first)
  })

  it('marks dirty when content changes', () => {
    const doc = useDocumentStore()
    doc.setContent('changed')
    expect(doc.isDirty).toBe(true)
  })

  it('markSaved clears dirty state and derives name from path', () => {
    const doc = useDocumentStore()
    doc.setContent('hello')
    doc.markSaved('/a/b.md')
    expect(doc.isDirty).toBe(false)
    expect(doc.activeTab!.path).toBe('/a/b.md')
    expect(doc.activeTab!.name).toBe('b.md')
  })

  it('loadFromPath reuses the tab for the same path', () => {
    const doc = useDocumentStore()
    doc.loadFromPath('/x.md', 'one')
    const id1 = doc.activeId
    doc.loadFromPath('/x.md', 'two')
    expect(doc.tabs).toHaveLength(2)
    expect(doc.activeTab!.content).toBe('two')
    expect(doc.activeId).toBe(id1)
  })

  it('closeDefaultWelcomeIfAlone removes a lone untouched welcome tab', () => {
    const doc = useDocumentStore()
    doc.closeDefaultWelcomeIfAlone()
    expect(doc.tabs).toHaveLength(0)
    doc.loadFromPath('/real.md', 'content')
    expect(doc.tabs).toHaveLength(1)
    expect(doc.activeTab!.path).toBe('/real.md')
  })

  it('closeDefaultWelcomeIfAlone keeps the welcome tab once edited', () => {
    const doc = useDocumentStore()
    doc.setContent('edited')
    doc.closeDefaultWelcomeIfAlone()
    expect(doc.tabs).toHaveLength(1)
  })

  it('closeTab activates an adjacent tab and never empties', () => {
    const doc = useDocumentStore()
    doc.newDocument()
    const b = doc.newDocument().id
    const c = doc.newDocument().id
    doc.activate(b)
    doc.closeTab(b)
    expect(doc.tabs.some((t) => t.id === b)).toBe(false)
    // 关闭中间的 b，应激活右侧 c
    expect(doc.activeId).toBe(c)
  })

  it('closeTab reports dirty flag', () => {
    const doc = useDocumentStore()
    const id = doc.activeId
    doc.setContent('x')
    const res = doc.closeTab(id)
    expect(res!.dirty).toBe(true)
  })

  it('pinTab toggles pinned state', () => {
    const doc = useDocumentStore()
    const id = doc.activeId
    doc.pinTab(id)
    expect(doc.activeTab!.isPinned).toBe(true)
    doc.pinTab(id)
    expect(doc.activeTab!.isPinned).toBe(false)
  })

  it('autoNameTab derives name from first H1 when no path', () => {
    const doc = useDocumentStore()
    const id = doc.activeId
    doc.setContent('# 我的笔记\n正文')
    doc.autoNameTab(id)
    expect(doc.activeTab!.name).toBe('我的笔记.md')
  })

  it('wordCount counts CJK + ascii', () => {
    const doc = useDocumentStore()
    doc.setContent('你好 world')
    expect(doc.wordCount).toBe(3)
  })

  it('revert restores content to saved version and clears dirty', () => {
    const doc = useDocumentStore()
    doc.setContent('saved text')
    doc.markSaved('/a.md')
    expect(doc.isDirty).toBe(false)
    doc.setContent('edited text')
    expect(doc.isDirty).toBe(true)
    const reverted = doc.revert()
    expect(reverted).toBe(true)
    expect(doc.activeTab!.content).toBe('saved text')
    expect(doc.isDirty).toBe(false)
  })

  it('revert is a no-op when there are no unsaved changes', () => {
    const doc = useDocumentStore()
    doc.setContent('saved text')
    doc.markSaved('/a.md')
    expect(doc.revert()).toBe(false)
    expect(doc.activeTab!.content).toBe('saved text')
  })

  it('revert can target a specific tab by id', () => {
    const doc = useDocumentStore()
    const a = doc.activeId
    doc.setContent('A-saved')
    doc.markSaved('/a.md')
    doc.setContent('A-edited')
    const b = doc.newDocument().id
    doc.setContent('B-saved')
    doc.markSaved('/b.md')
    doc.setContent('B-edited')
    expect(doc.revert(b)).toBe(true)
    expect(doc.tabs.find((t) => t.id === b)!.content).toBe('B-saved')
    // 另一标签不受影响
    expect(doc.tabs.find((t) => t.id === a)!.content).toBe('A-edited')
  })
})
