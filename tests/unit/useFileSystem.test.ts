import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentStore } from '../../src/stores/document'
import { useFileSystem } from '../../src/composables/useFileSystem'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('useFileSystem', () => {
  it('save writes content to path and marks saved', async () => {
    const tauri = getTauri()
    tauri.writeTextFile.mockResolvedValue(undefined)
    const doc = useDocumentStore()
    doc.loadFromPath('/vault/note.md', 'hello')
    doc.setContent('hello world')
    const fs = useFileSystem()
    const ok = await fs.save()
    expect(ok).toBe(true)
    expect(tauri.writeTextFile).toHaveBeenCalledWith('/vault/note.md', 'hello world')
    expect(doc.isDirty).toBe(false)
  })

  it('save without path triggers saveAs', async () => {
    const tauri = getTauri()
    tauri.save.mockResolvedValue('/new/note.md')
    tauri.writeTextFile.mockResolvedValue(undefined)
    const doc = useDocumentStore()
    const fs = useFileSystem()
    const ok = await fs.save()
    expect(ok).toBe(true)
    expect(tauri.save).toHaveBeenCalled()
    expect(doc.activeTab!.path).toBe('/new/note.md')
  })

  it('openByPath loads file into a tab', async () => {
    const tauri = getTauri()
    tauri.readTextFile.mockResolvedValue('# opened')
    const fs = useFileSystem()
    await fs.openByPath('/vault/x.md')
    const doc = useDocumentStore()
    expect(doc.activeTab!.content).toBe('# opened')
    expect(doc.activeTab!.path).toBe('/vault/x.md')
  })
})
