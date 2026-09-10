import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// 模拟 Tauri 插件（真实模块会调用 invoke，测试环境无后端）
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ writeFile: vi.fn() }))
// 模拟 HTML→PNG 渲染（依赖浏览器 Canvas/Image，happy-dom 不支持）
vi.mock('../../src/composables/useHtmlToPng', () => ({ htmlToPng: vi.fn() }))

import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { htmlToPng } from '../../src/composables/useHtmlToPng'
import { exportPng } from '../../src/composables/useExportPng'
import { useDocumentStore } from '../../src/stores/document'

const PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

function setActiveTab(name = 'note.md', content = '# 你好') {
  const doc = useDocumentStore()
  doc.tabs = [
    {
      id: 't1',
      path: null,
      name,
      content,
      savedContent: content,
      cursor: { line: 1, col: 1 },
      isPinned: false,
      lastSavedAt: null,
    },
  ]
  doc.activeId = 't1'
  return doc
}

describe('exportPng', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('用户在保存对话框取消时返回 false 且不写入文件', async () => {
    ;(save as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const ok = await exportPng()
    expect(ok).toBe(false)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('渲染成功时把 base64 解码为字节写入目标路径', async () => {
    ;(save as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/out.png')
    ;(htmlToPng as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(PNG_DATA)
    setActiveTab('report.md', '# 标题\n\n正文')
    const ok = await exportPng()
    expect(ok).toBe(true)
    expect(writeFile).toHaveBeenCalledTimes(1)
    const [path, bytes] = (writeFile as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(path).toBe('/tmp/out.png')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('渲染失败时返回 false 且不写入文件', async () => {
    ;(save as unknown as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/out.png')
    ;(htmlToPng as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    setActiveTab()
    const ok = await exportPng()
    expect(ok).toBe(false)
    expect(writeFile).not.toHaveBeenCalled()
  })
})
