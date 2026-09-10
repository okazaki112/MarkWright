/**
 * 工作区操作编排（v0.4.8）
 * 打开 / 切换 / 刷新 / 关闭工作区，统一在这里联动「文件树 + 链接索引 + 提示 + busy 状态」，
 * 避免 FilesTab 与命令面板各写一份导致行为不一致。
 */
import { useWorkspaceStore, parentDirOf } from '../stores/workspace'
import { useLinksStore } from '../stores/links'
import { useToastStore } from '../stores/toast'
import { useBusyStore } from '../stores/busy'

export function useWorkspaceActions() {
  const ws = useWorkspaceStore()
  const links = useLinksStore()
  const toasts = useToastStore()
  const busy = useBusyStore()

  /** 打开文件夹（未打开工作区时使用） */
  async function open(): Promise<boolean> {
    await ws.openWorkspace()
    if (!ws.rootPath) return false
    links.reset()
    toasts.success('已打开工作区', ws.rootName)
    void busy.run('扫描工作区…', () => links.scanWorkspace())
    return true
  }

  /** 切换到另一个文件夹 */
  async function switchTo(): Promise<boolean> {
    const before = ws.rootPath
    const ok = await ws.switchWorkspace()
    if (!ok || !ws.rootPath || ws.rootPath === before) return false
    links.reset()
    toasts.success('已切换工作区', ws.rootName)
    void busy.run('扫描工作区…', () => links.scanWorkspace())
    return true
  }

  /** 刷新文件树 + 重建链接索引 */
  async function refresh(): Promise<void> {
    if (!ws.rootPath) return
    await busy.run('刷新工作区…', () => ws.refresh())
    void busy.run('扫描工作区…', () => links.scanWorkspace())
  }

  /** 关闭工作区（不影响已打开的文档） */
  function close(): void {
    if (!ws.rootPath) return
    ws.closeWorkspace()
    links.reset()
    toasts.info('已关闭工作区', '已打开的文档不会被关闭')
  }

  /** 以某个文件的所在目录作为工作区根目录（标签页右键“设为工作区”） */
  async function setFromPath(filePath: string): Promise<boolean> {
    // 用纯 JS 取父目录并保留原始分隔符（Windows 为 \），
    // 与“打开文件夹”对话框返回的原生路径格式一致，避免 readDir 因 / 分隔符失败
    const dir = parentDirOf(filePath)
    try {
      await ws.setRoot(dir)
    } catch (e) {
      toasts.error('设为工作区失败', String(e))
      return false
    }
    links.reset()
    toasts.success('已设为工作区', ws.rootName)
    void busy.run('扫描工作区…', () => links.scanWorkspace())
    return true
  }

  return { open, switchTo, refresh, close, setFromPath }
}
