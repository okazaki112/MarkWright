/**
 * 文件系统操作：新建/打开/保存/另存为（多 Tab 版）
 */
import { open as openDialog, save as saveDialog, ask } from '@tauri-apps/plugin-dialog'
import { openPath } from '@tauri-apps/plugin-opener'
import { useDocumentStore } from '../stores/document'
import { parentDirOf } from '../stores/workspace'
import { useToastStore } from '../stores/toast'
import { useBusyStore } from '../stores/busy'
import { useVault, useVaultState } from './useVault'

const MD_FILTERS = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] }]

/** 判断是否为「用户主动取消」而非真实错误 */
function isCancelled(err: unknown): boolean {
  return String(err).includes('已取消')
}

export function useFileSystem() {
  const toasts = useToastStore()
  const busy = useBusyStore()
  const vault = useVault()
  const vaultState = useVaultState()

  async function save(): Promise<boolean> {
    const doc = useDocumentStore()
    const tab = doc.activeTab
    if (!tab) return false
    if (!tab.path) return saveAs()
    try {
      // 启用工作区加密时 writeDocument 会直接写密文（磁盘零明文）
      await busy.run('保存中…', () => vault.writeDocument(tab.path as string, tab.content))
      doc.markSaved(tab.path)
      const encrypted = vaultState.enabled.value
      toasts.success('已保存', encrypted ? `${tab.path}（已加密）` : tab.path)
      return true
    } catch (err) {
      if (isCancelled(err)) {
        toasts.info('已取消保存', '加密保存需要先解锁')
        return false
      }
      toasts.error('保存失败', String(err))
      return false
    }
  }

  async function saveAs(): Promise<boolean> {
    const doc = useDocumentStore()
    const tab = doc.activeTab
    if (!tab) return false
    const target = await saveDialog({
      title: '另存为',
      defaultPath: tab.name,
      filters: MD_FILTERS,
    })
    if (!target) return false
    try {
      await busy.run('另存中…', () => vault.writeDocument(target, tab.content))
      doc.markSaved(target)
      toasts.success('已另存为', vaultState.enabled.value ? `${target}（已加密）` : target)
      return true
    } catch (err) {
      if (isCancelled(err)) {
        toasts.info('已取消另存', '加密保存需要先解锁')
        return false
      }
      toasts.error('另存为失败', String(err))
      return false
    }
  }

  async function confirmDiscardIfDirty(): Promise<boolean> {
    const doc = useDocumentStore()
    const tab = doc.activeTab
    if (!tab || tab.content === tab.savedContent) return true
    const choice = await ask(`「${tab.name}」有未保存的修改，是否保存？`, {
      title: '未保存的修改',
      kind: 'warning',
      okLabel: '保存',
      cancelLabel: '放弃',
    })
    if (!choice) return true
    return save()
  }

  async function newFile() {
    const ok = await confirmDiscardIfDirty()
    if (!ok) return
    useDocumentStore().newDocument()
  }

  async function openFile() {
    const ok = await confirmDiscardIfDirty()
    if (!ok) return
    const selected = await openDialog({
      multiple: false,
      directory: false,
      filters: MD_FILTERS,
      title: '打开 Markdown 文件',
    })
    if (!selected || Array.isArray(selected)) return
    try {
      // 自动识别密文并解密（需要时弹出主密码框）
      const text = await busy.run('打开中…', () => vault.readDocument(selected))
      useDocumentStore().loadFromPath(selected, text)
      toasts.success('已打开', selected)
    } catch (err) {
      if (isCancelled(err)) return
      toasts.error('打开失败', String(err))
    }
  }

  /**
   * 放弃修改：经二次确认后恢复到上次保存的版本。
   * @param id 指定 Tab（如标签页右键菜单）；省略则作用于当前活动 Tab
   * @returns 是否执行了放弃（取消或不脏时为 false/true 视情况）
   */
  async function confirmRevert(id?: string): Promise<boolean> {
    const doc = useDocumentStore()
    const tab = id ? doc.tabs.find((t) => t.id === id) : doc.activeTab
    if (!tab || tab.content === tab.savedContent) return false
    const choice = await ask(
      `确定放弃「${tab.name}」的未保存修改，恢复到上次保存的版本？`,
      { title: '放弃修改', kind: 'warning', okLabel: '放弃修改', cancelLabel: '保留' },
    )
    if (choice) {
      doc.revert(id)
      toasts.info('已放弃修改', '已恢复到上次保存的版本')
      return true
    }
    return false
  }

  /** 由文件树触发：加载指定路径到 Tab（已有则激活） */
  async function openByPath(path: string) {
    try {
      const text = await busy.run('打开中…', () => vault.readDocument(path))
      useDocumentStore().loadFromPath(path, text)
    } catch (err) {
      if (isCancelled(err)) return
      toasts.error('打开失败', String(err))
    }
  }

  /** 在系统文件管理器中打开某文件所在的文件夹（标签页右键“打开文件路径文件夹”） */
  async function openFileFolder(filePath: string): Promise<void> {
    const dir = parentDirOf(filePath)
    try {
      await openPath(dir)
      toasts.info('已在文件管理器中打开', dir)
    } catch (err) {
      toasts.error('打开文件夹失败', String(err))
    }
  }

  return {
    newFile,
    openFile,
    save,
    saveAs,
    openByPath,
    confirmRevert,
    openFileFolder,
  }
}
