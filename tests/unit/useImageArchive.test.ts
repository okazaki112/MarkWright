import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkspaceStore } from '../../src/stores/workspace'
import { useDocumentStore } from '../../src/stores/document'
import { useImageArchive, getExt, timestampName } from '../../src/composables/useImageArchive'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('imageArchive helpers', () => {
  it('getExt derives extension from mime or filename', () => {
    expect(getExt('image/png')).toBe('png')
    expect(getExt('image/jpeg')).toBe('jpg')
    expect(getExt('IMG.PNG')).toBe('png')
    expect(getExt('noext')).toBe('png')
  })

  it('timestampName returns a compact ymd-hms string', () => {
    expect(timestampName()).toMatch(/^\d{8}-\d{6}$/)
  })
})

describe('imageArchive archive', () => {
  it('writes file into assets/ and returns relative path', async () => {
    const tauri = getTauri()
    tauri.exists.mockResolvedValue(false)
    tauri.mkdir.mockResolvedValue(undefined)
    tauri.writeFile.mockResolvedValue(undefined)
    tauri.join.mockImplementation((...p: string[]) => p.join('/'))
    const ws = useWorkspaceStore()
    ws.rootPath = '/vault'
    const ia = useImageArchive()
    const file = {
      type: 'image/png',
      name: 'photo.png',
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as unknown as File
    const rel = await ia.archive(file)
    expect(rel).toMatch(/^\.\/assets\/.+\.png$/)
    expect(tauri.writeFile).toHaveBeenCalled()
  })

  it('rejects disallowed file types', async () => {
    const tauri = getTauri()
    tauri.join.mockImplementation((...p: string[]) => p.join('/'))
    const ws = useWorkspaceStore()
    ws.rootPath = '/vault'
    const ia = useImageArchive()
    const file = {
      type: 'text/plain',
      name: 'note.txt',
      arrayBuffer: async () => new ArrayBuffer(0),
    } as unknown as File
    expect(await ia.archive(file)).toBeNull()
  })

  it('archives into the document-adjacent assets/ when the document has a path', async () => {
    const tauri = getTauri()
    tauri.exists.mockResolvedValue(false)
    tauri.mkdir.mockResolvedValue(undefined)
    tauri.writeFile.mockResolvedValue(undefined)
    tauri.join.mockImplementation((...p: string[]) => p.join('/'))
    tauri.dirname.mockImplementation((p: string) => p.split('/').slice(0, -1).join('/'))
    const ws = useWorkspaceStore()
    ws.rootPath = '/vault'
    const doc = useDocumentStore()
    doc.tabs[0].path = '/vault/notes/a.md'

    const ia = useImageArchive()
    const file = {
      type: 'image/png',
      name: 'photo.png',
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as unknown as File
    const rel = await ia.archive(file)
    expect(rel).toMatch(/^\.\/assets\/.+\.png$/)
    // 关键：写入文档同级 notes/assets，而非工作区根 assets
    expect(tauri.mkdir.mock.calls[0][0]).toBe('/vault/notes/assets')
  })
})
