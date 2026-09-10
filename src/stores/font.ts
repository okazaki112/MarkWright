/**
 * 字体设置 store（v0.4.9）
 * 字体从主题中拆分出来，作为独立设置：
 *  - 主题只负责颜色 / 装饰 / 纹理 / 密度 / 动效
 *  - 字体（UI / 正文 / 标题 / 代码 + 正文字号）由本 store 统一管理，持久化保存
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 可选字体预设（值即 CSS font-family 字符串） */
export const FONT_PRESETS: Record<string, string> = {
  'system-sans':
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
  'source-han-sans':
    "'Source Han Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
  'system-serif':
    "'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', SimSun, 'STSong', 'Times New Roman', Georgia, serif",
  'source-han-serif':
    "'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', SimSun, serif",
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Source Code Pro', Menlo, Consolas, 'Liberation Mono', monospace",
  'system-mono': "Menlo, Consolas, 'Liberation Mono', monospace",
}

export type FontCategory = 'ui' | 'serif' | 'display' | 'mono'

/** 下拉选项（所有分类共用，仅默认值不同） */
export const FONT_OPTIONS: { id: string; label: string }[] = [
  { id: 'system-sans', label: '系统无衬线' },
  { id: 'source-han-sans', label: '思源黑体' },
  { id: 'system-serif', label: '系统衬线' },
  { id: 'source-han-serif', label: '思源宋体' },
  { id: 'mono', label: '等宽（JetBrains/Fira）' },
  { id: 'system-mono', label: '系统等宽' },
]

/** 常见系统字体（供字体设置下拉建议；也可直接输入系统已安装的任何字体名） */
export const SYSTEM_FONTS: { label: string; value: string }[] = [
  // 中文系统字体
  { label: '微软雅黑', value: "'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { label: '等线', value: "'DengXian', 'Microsoft YaHei', sans-serif" },
  { label: '黑体', value: "'SimHei', sans-serif" },
  { label: '宋体', value: "SimSun, 'Songti SC', serif" },
  { label: '楷体', value: "KaiTi, 'Kaiti SC', serif" },
  { label: '仿宋', value: "FangSong, 'STFangsong', serif" },
  { label: '苹方 (PingFang SC)', value: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: '思源黑体', value: "'Source Han Sans SC', 'Noto Sans CJK SC', 'PingFang SC', sans-serif" },
  { label: '思源宋体', value: "'Source Han Serif SC', 'Noto Serif CJK SC', 'Songti SC', serif" },
  // 英文字体
  { label: 'Segoe UI', value: "'Segoe UI', system-ui, sans-serif" },
  { label: 'Arial', value: "Arial, Helvetica, sans-serif" },
  { label: 'Calibri', value: "Calibri, sans-serif" },
  { label: 'Times New Roman', value: "'Times New Roman', Georgia, serif" },
  { label: 'Georgia', value: "Georgia, serif" },
  { label: 'Consolas', value: "Consolas, 'Courier New', monospace" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Menlo', value: "Menlo, Monaco, monospace" },
  { label: 'Verdana', value: "Verdana, Geneva, sans-serif" },
  { label: 'Tahoma', value: "Tahoma, Geneva, sans-serif" },
  { label: 'Cambria', value: "Cambria, Georgia, serif" },
]

const STORAGE_KEY = 'markwright:font'

const DEFAULTS = {
  ui: FONT_PRESETS['system-sans'],
  serif: FONT_PRESETS['system-sans'],
  display: FONT_PRESETS['source-han-sans'],
  mono: FONT_PRESETS['mono'],
  fontSize: 15, // 预览正文字号(px)
}

function readStored(): typeof DEFAULTS {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useFontStore = defineStore('font', () => {
  const saved = readStored()
  const ui = ref(saved.ui)
  const serif = ref(saved.serif)
  const display = ref(saved.display)
  const mono = ref(saved.mono)
  const fontSize = ref(saved.fontSize)

  /** 把字体设置写到根元素 CSS 变量（覆盖主题/令牌默认值） */
  function applyFonts() {
    const root = document.documentElement
    root.style.setProperty('--font-sans', ui.value)
    root.style.setProperty('--font-serif', serif.value)
    root.style.setProperty('--font-display', display.value)
    root.style.setProperty('--font-mono', mono.value)
    root.style.setProperty('--fz-preview', fontSize.value + 'px')
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ui: ui.value, serif: serif.value, display: display.value, mono: mono.value, fontSize: fontSize.value }))
    } catch {
      /* 忽略 */
    }
  }

  function setFont(cat: FontCategory, value: string) {
    if (cat === 'ui') ui.value = value
    else if (cat === 'serif') serif.value = value
    else if (cat === 'display') display.value = value
    else if (cat === 'mono') mono.value = value
    applyFonts()
    persist()
  }

  function setFontSize(px: number) {
    fontSize.value = px
    applyFonts()
    persist()
  }

  function resetFonts() {
    ui.value = DEFAULTS.ui
    serif.value = DEFAULTS.serif
    display.value = DEFAULTS.display
    mono.value = DEFAULTS.mono
    fontSize.value = DEFAULTS.fontSize
    applyFonts()
    persist()
  }

  // 启动时应用
  applyFonts()

  return {
    ui,
    serif,
    display,
    mono,
    fontSize,
    applyFonts,
    setFont,
    setFontSize,
    resetFonts,
  }
})
