/**
 * 自动保存 composable
 * - 监听活动 Tab 内容变化，debounce 后写入
 * - 只对已落盘（path 存在）的文件自动保存；未保存过的仍需用户主动 Save
 * - 通过 setTimeout + clearTimeout 实现
 */
import { watch } from 'vue'
import { useDocumentStore } from '../stores/document'
import { useUIStore } from '../stores/ui'
import { useVault } from './useVault'

export function useAutoSave() {
  const doc = useDocumentStore()
  const ui = useUIStore()
  const vault = useVault()
  let timer: number | undefined

  watch(
    () => doc.activeTab?.content,
    () => {
      if (!ui.autoSaveEnabled) return
      if (timer) clearTimeout(timer)
      timer = window.setTimeout(async () => {
        const tab = doc.activeTab
        if (!tab || !tab.path) return
        if (tab.content === tab.savedContent) return
        try {
          // 静默写入：启用加密且已解锁则落盘密文；未解锁则跳过（不弹窗打扰），
          // 等用户主动保存时再提示输入主密码。
          const ok = await vault.writeDocumentQuiet(tab.path, tab.content)
          if (!ok) return
          tab.savedContent = tab.content
          tab.lastSavedAt = Date.now()
        } catch (e) {
          console.warn('autoSave failed', e)
        }
      }, ui.autoSaveInterval)
    }
  )
}
