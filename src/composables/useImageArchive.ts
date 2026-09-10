/**
 * 图片粘贴/拖入自动归档
 * - 工作区下创建 assets/ 目录
 * - 文件名：yyyy-mm-dd-hhmmss-原名
 * - 在光标位置插入 ![](./assets/xxx)
 * - 通过自定义事件 markwright:editor-cmd 通知 EditorPane
 */
import { useWorkspaceStore } from '../stores/workspace'
import { useDocumentStore } from '../stores/document'
import { exists, mkdir, writeFile } from '@tauri-apps/plugin-fs'
import { dirname, join } from '@tauri-apps/api/path'

const ALLOWED = /^image\/(png|jpe?g|gif|webp|svg|bmp)$/i

export function getExt(nameOrType: string): string {
  if (nameOrType.includes('/')) {
    const m = nameOrType.match(/image\/(png|jpe?g|gif|webp|svg|bmp)/i)
    if (m) return m[1] === 'jpeg' ? 'jpg' : m[1].toLowerCase()
  }
  const m = nameOrType.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : 'png'
}

export function timestampName(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export function useImageArchive() {
  const ws = useWorkspaceStore()
  const doc = useDocumentStore()

  /**
   * 归档目录：优先「当前文档同级」的 assets/，让插入的 ./assets/xxx 相对引用
   * 在子目录文档、迁移到其他编辑器后依然成立；文档未保存时退回工作区根 assets/。
   */
  async function ensureAssetsDir(): Promise<string | null> {
    let base: string | null = null
    const docPath = doc.activeTab?.path ?? null
    if (docPath) {
      try {
        base = await dirname(docPath)
      } catch {
        base = null
      }
    }
    if (!base) base = ws.rootPath
    if (!base) return null
    const dir = await join(base, 'assets')
    try {
      if (!(await exists(dir))) {
        await mkdir(dir, { recursive: true })
      }
      return dir
    } catch (e) {
      console.error('ensureAssetsDir failed', e)
      return null
    }
  }

  async function archive(file: File): Promise<string | null> {
    if (!ALLOWED.test(file.type) && !file.name.match(/\.(png|jpe?g|gif|webp|svg|bmp)$/i)) {
      return null
    }
    const dir = await ensureAssetsDir()
    if (!dir) return null
    const ext = getExt(file.type || file.name)
    const baseName = `${timestampName()}-${file.name.replace(/\.[^.]+$/, '').replace(/[^\w\u4e00-\u9fa5-]/g, '_')}`
    const fileName = `${baseName}.${ext}`
    const filePath = await join(dir, fileName)
    const buf = new Uint8Array(await file.arrayBuffer())
    try {
      await writeFile(filePath, buf)
      return `./assets/${fileName}`
    } catch (e) {
      console.error('writeFile failed', e)
      return null
    }
  }

  async function paste(file: File) {
    const rel = await archive(file)
    if (rel) {
      const md = `![${file.name}](${rel})`
      window.dispatchEvent(
        new CustomEvent('markwright:editor-cmd', {
          detail: { cmd: 'insertText', text: md },
        })
      )
    }
  }

  return { paste, archive }
}
