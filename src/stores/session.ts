/**
 * 会话状态持久化
 * - 启动时恢复：workspace 路径、打开的 tab 文件路径、滚动位置
 * - 关闭时保存到 app_data_dir/session.json
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useDocumentStore } from './document'
import { useWorkspaceStore } from './workspace'
import { useUIStore, type ViewMode } from './ui'
import { readTextFile, writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs'
import { join, appDataDir } from '@tauri-apps/api/path'

export interface SessionState {
  workspacePath: string | null
  openFilePaths: string[]
  activePath: string | null
  splitRatio: number
  viewMode: string
  sidebarOpen: boolean
  scrollSync: boolean
  themeId: string
}

const FILE_NAME = 'session.json'

export const useSessionStore = defineStore('session', () => {
  const doc = useDocumentStore()
  const ws = useWorkspaceStore()
  const ui = useUIStore()
  const saving = ref(false)
  const lastSavedAt = ref<number>(0)

  async function getSessionPath(): Promise<string> {
    const dir = await appDataDir()
    await mkdir(dir, { recursive: true })
    return await join(dir, FILE_NAME)
  }

  async function save() {
    saving.value = true
    try {
      const state: SessionState = {
        workspacePath: ws.rootPath,
        openFilePaths: doc.tabs
          .filter((t) => !!t.path)
          .map((t) => t.path as string),
        activePath: doc.activeTab?.path ?? null,
        splitRatio: ui.splitRatio,
        viewMode: ui.viewMode,
        sidebarOpen: ui.sidebarOpen,
        scrollSync: ui.scrollSync,
        themeId: localStorage.getItem('markwright:themeId') || 'dark',
      }
      const path = await getSessionPath()
      await writeTextFile(path, JSON.stringify(state, null, 2))
      lastSavedAt.value = Date.now()
    } catch (e) {
      console.warn('session save failed', e)
    } finally {
      saving.value = false
    }
  }

  async function restore(): Promise<boolean> {
    try {
      const path = await getSessionPath()
      if (!(await exists(path))) return false
      const text = await readTextFile(path)
      const state: SessionState = JSON.parse(text)
      // 恢复 UI 状态
      ui.setViewMode(state.viewMode as ViewMode)
      ui.setSplitRatio(state.splitRatio)
      ui.sidebarOpen = state.sidebarOpen
      ui.scrollSync = state.scrollSync
      // 恢复 workspace（侧边栏文件树根目录）
      if (state.workspacePath && (await exists(state.workspacePath))) {
        await ws.setRoot(state.workspacePath)
      }
      // 注意：刻意不恢复历史打开的标签页（openFilePaths / activePath）。
      // 原因：① 重启后从空白（欢迎页）开始，避免旧文档残留；
      //       ② 否则双击 .md 关联打开时，restore() 的多次 await 会比
      //          take_pending_file → loadFromPath 更晚执行，把新文件的活动页
      //          覆盖回旧页面，导致“显示前面打开的页面、不跳转”的问题。
      return true
    } catch (e) {
      console.warn('session restore failed', e)
      return false
    }
  }

  // 定期保存 + 关闭前保存
  let timer: number | undefined
  function startAutoSave() {
    if (timer) return
    timer = window.setInterval(() => save(), 30000)
  }
  function stopAutoSave() {
    if (timer) { clearInterval(timer); timer = undefined }
    // v0.4.8：同时清掉防抖定时器，避免残留引用与卸载后的迟到写入
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = undefined }
  }

  /** v0.4.8：释放全部定时器（应用卸载 / HMR 时调用） */
  function dispose() {
    stopAutoSave()
  }

  // 监听状态变化时立即保存（防抖）
  let debounceTimer: number | undefined
  watch(
    () => [
      doc.tabs.map((t) => `${t.id}:${t.path}:${t.savedContent === t.content ? 0 : 1}`).join('|'),
      doc.activeId,
      ws.rootPath,
      ui.splitRatio,
      ui.viewMode,
      ui.sidebarOpen,
      ui.scrollSync,
    ],
    () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = window.setTimeout(() => save(), 2000)
    }
  )

  return { save, restore, startAutoSave, stopAutoSave, dispose, lastSavedAt, saving }
})
