/**
 * 主题 store（逻辑层）
 * v0.4.8：主题数据已拆到 `src/data/themes.ts`，本文件只负责状态与应用逻辑
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { BUILTIN_THEMES, CONTENT_STYLE_BY_THEME } from '../data/themes'
import type { ThemeMeta } from '../data/themes'

// 兼容既有 import：`import type { ThemeMeta } from '../stores/theme'`
export type {
  ThemeMeta,
  ThemeFonts,
  DecorationMode,
  SurfacePattern,
  MotionMode,
  DensityMode,
  ContentStyle,
} from '../data/themes'
export { BUILTIN_THEMES }

const STORAGE_KEY = 'markwright:themeId'

/** 所有主题声明过的变量名（模块加载时算一次，避免每次切主题重算）
 * 注意：字体变量（--font-*）不再随主题切换，改由独立的字体设置控制，故不在此列表 */
const ALL_VARS: string[] = (() => {
  const all = new Set<string>()
  for (const t of BUILTIN_THEMES) {
    for (const k of Object.keys(t.vars)) all.add(k)
  }
  return Array.from(all)
})()

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'dark'
  } catch {
    return 'dark'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const currentId = ref<string>(readStored())
  const themes = ref<ThemeMeta[]>(BUILTIN_THEMES)
  const settingsOpen = ref(false)

  const current = (): ThemeMeta =>
    themes.value.find((t) => t.id === currentId.value) || themes.value[0]

  /** 应用主题到根元素 */
  function applyTheme(id: string) {
    const t = themes.value.find((x) => x.id === id)
    if (!t) return
    currentId.value = id
    const root = document.documentElement
    const style = root.style

    // 1. 清除所有主题可能设置过的内联变量
    for (const k of ALL_VARS) style.removeProperty(k)

    // 2. 应用颜色变量
    if (t.vars && Object.keys(t.vars).length) {
      for (const [k, v] of Object.entries(t.vars)) {
        style.setProperty(k, v)
      }
    }

    // 3. 应用装饰模式（data-* 属性 + body class）
    // 字体不再由主题设置，改由独立的字体设置（font store）控制
    root.setAttribute('data-decoration', t.decoration)
    root.setAttribute('data-surface', t.surface)
    root.setAttribute('data-motion', t.motion)
    root.setAttribute('data-density', t.density)
    root.setAttribute('data-theme', t.isDark ? 'dark' : 'light')
    root.setAttribute(
      'data-content',
      CONTENT_STYLE_BY_THEME[t.id] ?? 'modern'
    )
    document.body.classList.toggle('is-dark', t.isDark)
  }

  function setTheme(id: string) {
    applyTheme(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* 忽略 */
    }
  }

  function nextTheme() {
    const idx = themes.value.findIndex((t) => t.id === currentId.value)
    const next = themes.value[(idx + 1) % themes.value.length]
    setTheme(next.id)
  }

  function openSettings() {
    settingsOpen.value = true
  }
  function closeSettings() {
    settingsOpen.value = false
  }

  // 启动时应用
  applyTheme(currentId.value)

  return {
    currentId,
    themes,
    settingsOpen,
    current,
    setTheme,
    nextTheme,
    openSettings,
    closeSettings,
    applyTheme,
  }
})
