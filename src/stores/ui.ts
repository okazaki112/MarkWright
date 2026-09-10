/**
 * UI 状态：视图模式、分屏比例
 * 主题由 theme store 接管
 */
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ViewMode = 'split' | 'editor' | 'preview'

const VIEW_KEY = 'markwright:view'
const RATIO_KEY = 'markwright:ratio'
const SIDEBAR_W_KEY = 'markwright:sidebarWidth'

/** 侧边栏宽度边界 */
export const SIDEBAR_MIN_W = 200
export const SIDEBAR_MAX_W = 560
export const SIDEBAR_DEFAULT_W = 300

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 忽略 */
  }
}

export const useUIStore = defineStore('ui', () => {
  const viewMode = ref<ViewMode>(readStored<ViewMode>(VIEW_KEY, 'split'))
  const splitRatio = ref<number>(readStored<number>(RATIO_KEY, 0.5))
  const scrollSync = ref<boolean>(true)
  const sidebarOpen = ref<boolean>(readStored<boolean>('markwright:sidebar', true))
  const autoSaveEnabled = ref<boolean>(readStored<boolean>('markwright:autoSave', true))
  const autoSaveInterval = ref<number>(readStored<number>('markwright:autoSaveInterval', 2000))
  const mermaidEnabled = ref<boolean>(readStorageBool('markwright:mermaid', true))
  const katexEnabled = ref<boolean>(readStorageBool('markwright:katex', true))
  /** 侧边栏宽度（可拖拽调整，持久化） */
  const sidebarWidth = ref<number>(clampSidebarW(readStored<number>(SIDEBAR_W_KEY, SIDEBAR_DEFAULT_W)))
  /** 专注模式：隐藏外壳 UI，仅保留编辑区 + 悬浮番茄钟 */
  const focusMode = ref<boolean>(false)

  function setFocusMode(v: boolean) {
    focusMode.value = v
  }
  function toggleFocusMode() {
    focusMode.value = !focusMode.value
  }

  function clampSidebarW(v: number): number {
    if (!Number.isFinite(v)) return SIDEBAR_DEFAULT_W
    return Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, Math.round(v)))
  }

  function setSidebarWidth(px: number) {
    sidebarWidth.value = clampSidebarW(px)
  }
  function resetSidebarWidth() {
    sidebarWidth.value = SIDEBAR_DEFAULT_W
  }

  function setViewMode(next: ViewMode) {
    viewMode.value = next
  }
  function setSplitRatio(next: number) {
    splitRatio.value = Math.min(0.8, Math.max(0.2, next))
  }
  function toggleScrollSync() {
    scrollSync.value = !scrollSync.value
  }
  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }
  function setAutoSave(v: boolean) {
    autoSaveEnabled.value = v
    writeStored('markwright:autoSave', v)
  }
  function setAutoSaveInterval(ms: number) {
    autoSaveInterval.value = ms
    writeStored('markwright:autoSaveInterval', ms)
  }

  watch(viewMode, (v) => writeStored(VIEW_KEY, v))
  watch(splitRatio, (v) => writeStored(RATIO_KEY, v))
  watch(sidebarOpen, (v) => writeStored('markwright:sidebar', v))
  watch(sidebarWidth, (v) => writeStored(SIDEBAR_W_KEY, v))
  // 专注模式同步到 body class，供全局样式（滚动条、内边距等）使用
  watch(
    focusMode,
    (v) => {
      try {
        document.body.classList.toggle('focus-mode', v)
      } catch {
        /* 非 DOM 环境忽略 */
      }
    },
    { immediate: true },
  )

  return {
    viewMode,
    splitRatio,
    scrollSync,
    sidebarOpen,
    autoSaveEnabled,
    autoSaveInterval,
    mermaidEnabled,
    katexEnabled,
    sidebarWidth,
    focusMode,
    setFocusMode,
    toggleFocusMode,
    setViewMode,
    setSplitRatio,
    setSidebarWidth,
    resetSidebarWidth,
    toggleScrollSync,
    toggleSidebar,
    setAutoSave,
    setAutoSaveInterval,
  }
})

function readStorageBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return v === '1'
  } catch {
    return fallback
  }
}
