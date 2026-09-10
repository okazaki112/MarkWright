/**
 * 文档状态：多 Tab + 当前活动 Tab
 * 每个 Tab 独立保存：路径、内容、savedContent、cursor
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface Tab {
  id: string                  // 唯一 id（本地生成）
  path: string | null         // null = 未保存草稿
  name: string                // 显示名
  content: string
  savedContent: string
  cursor: { line: number; col: number }
  isPinned: boolean
  lastSavedAt: number | null  // 自动保存时间戳
}

function uid(): string {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function deriveName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || path
}

function newTab(content: string = ''): Tab {
  return {
    id: uid(),
    path: null,
    name: '未命名.md',
    content,
    savedContent: content,
    cursor: { line: 1, col: 1 },
    isPinned: false,
    lastSavedAt: null,
  }
}

const DEFAULT_CONTENT = `# 欢迎使用 MarkWright

一款为认真写作而生的 Markdown 桌面编辑器。

## 核心特性

- **实时预览** — 左右分屏，所见即所得
- **专业编辑** — 基于 CodeMirror 6，对标 VSCode
- **原生体验** — Tauri 驱动，体积小、启动快
- **快捷键** — Ctrl/Cmd + B/I/K 即时格式化

## 试试这些操作

1. 在左侧编辑任意文字，右侧会自动渲染
2. 使用顶部工具栏插入 *列表*、**表格**、\`代码\`
3. 按 \`Ctrl/Cmd + S\` 保存到本地

\`\`\`typescript
function greet(name: string) {
  return \`Hello, \${name}!\`
}
\`\`\`

> 💡 提示：在文件菜单中可以切换**深色 / 浅色**主题。
`

export const useDocumentStore = defineStore('document', () => {
  const tabs = ref<Tab[]>([newTab(DEFAULT_CONTENT)])
  const activeId = ref<string>(tabs.value[0].id)

  const activeTab = computed<Tab | null>(() => tabs.value.find((t) => t.id === activeId.value) ?? null)

  const isDirty = computed(() => activeTab.value?.content !== activeTab.value?.savedContent)
  const isEmpty = computed(() => (activeTab.value?.content.length ?? 0) === 0)
  const lineCount = computed(() => activeTab.value?.content.split('\n').length ?? 0)
  const wordCount = computed(() => {
    const text = activeTab.value?.content ?? ''
    const cjk = (text.match(/[一-龥]/g) || []).length
    const ascii = (text.match(/[A-Za-z0-9_]+/g) || []).length
    return cjk + ascii
  })
  const cursor = computed(() => activeTab.value?.cursor ?? { line: 1, col: 1 })
  const titleText = computed(() => {
    const t = activeTab.value
    if (!t) return ''
    const prefix = t.content !== t.savedContent ? '● ' : ''
    return `${prefix}${t.name}`
  })

  // ---------- 动作 ----------
  function setContent(next: string) {
    const t = activeTab.value
    if (!t) return
    t.content = next
  }

  function setCursor(line: number, col: number) {
    const t = activeTab.value
    if (!t) return
    t.cursor = { line, col }
  }

  function markSaved(path: string | null, name?: string) {
    const t = activeTab.value
    if (!t) return
    t.savedContent = t.content
    t.lastSavedAt = Date.now()
    if (path !== null) {
      t.path = path
      t.name = name ?? deriveName(path)
    } else if (name) {
      t.name = name
    }
  }

  function newDocument() {
    const t = newTab('')
    tabs.value.push(t)
    activeId.value = t.id
    return t
  }

  function loadFromPath(path: string, text: string) {
    // 若已有同 path 的 Tab，复用它；否则新建
    const exist = tabs.value.find((t) => t.path === path)
    if (exist) {
      exist.content = text
      exist.savedContent = text
      exist.lastSavedAt = Date.now()
      activeId.value = exist.id
      return exist
    }
    const t = newTab(text)
    t.path = path
    t.name = deriveName(path)
    t.savedContent = text
    t.lastSavedAt = Date.now()
    tabs.value.push(t)
    activeId.value = t.id
    return t
  }

  /**
   * v0.4.8：关闭当前 Tab 时激活「相邻」的 Tab（优先右侧、其次左侧），
   * 而不是无条件跳回第 1 个 —— 原来关第 3 个会跳到第 1 个，顺序感断裂。
   */
  function closeTab(id: string): { dirty: boolean; tab: Tab } | null {
    const idx = tabs.value.findIndex((x) => x.id === id)
    if (idx < 0) return null
    const t = tabs.value[idx]
    const dirty = t.content !== t.savedContent
    const wasActive = activeId.value === id

    // 先算出继任者（含固定 Tab 优先的简单策略：就近即可）
    const next = tabs.value[idx + 1] ?? tabs.value[idx - 1] ?? null

    tabs.value = tabs.value.filter((x) => x.id !== id)

    if (wasActive) {
      activeId.value = next ? next.id : ''
    }
    if (tabs.value.length === 0) {
      const fresh = newTab('')
      tabs.value.push(fresh)
      activeId.value = fresh.id
    }
    // 兜底：activeId 指向了已被移除的 Tab
    if (activeId.value && !tabs.value.some((x) => x.id === activeId.value)) {
      activeId.value = tabs.value[0]?.id ?? ''
    }
    return { dirty, tab: t }
  }

  function activate(id: string) {
    if (tabs.value.find((t) => t.id === id)) {
      activeId.value = id
    }
  }

  function updateTabContent(id: string, content: string) {
    const t = tabs.value.find((x) => x.id === id)
    if (t) t.content = content
  }

  function pinTab(id: string) {
    const t = tabs.value.find((x) => x.id === id)
    if (t) t.isPinned = !t.isPinned
  }

  /**
   * 放弃修改：把内容恢复到上次保存的版本（savedContent）。
   * 无未保存修改时为空操作，返回 false。
   * @param id 指定 Tab；省略则作用于当前活动 Tab
   */
  function revert(id?: string): boolean {
    const t = id ? tabs.value.find((x) => x.id === id) : activeTab.value
    if (!t) return false
    if (t.content === t.savedContent) return false
    t.content = t.savedContent
    return true
  }

  // 给没有路径的 Tab 命名（首行 H1 提取）
  function autoNameTab(id: string) {
    const t = tabs.value.find((x) => x.id === id)
    if (!t || t.path) return
    const firstHeading = t.content.match(/^#\s+(.+)$/m)
    if (firstHeading) {
      t.name = firstHeading[1].trim().slice(0, 40) + '.md'
    }
  }

  /**
   * 仅当当前只有一个“未改动的默认欢迎页”时将其移除。
   * 用于「双击 .md 打开」场景：避免欢迎页与打开的文件并存，
   * 让用户直接看到被关联打开的文档（而非欢迎页 + 文件两个标签）。
   */
  function closeDefaultWelcomeIfAlone() {
    if (tabs.value.length === 1) {
      const t = tabs.value[0]
      if (t.path === null && t.content === DEFAULT_CONTENT) {
        tabs.value = []
        activeId.value = ''
      }
    }
  }

  return {
    tabs,
    activeId,
    activeTab,
    isDirty,
    isEmpty,
    lineCount,
    wordCount,
    cursor,
    titleText,
    setContent,
    setCursor,
    markSaved,
    newDocument,
    loadFromPath,
    closeTab,
    activate,
    updateTabContent,
    pinTab,
    revert,
    autoNameTab,
    closeDefaultWelcomeIfAlone,
  }
})
