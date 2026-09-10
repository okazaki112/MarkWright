<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView } from '@codemirror/view'
import { EditorState, EditorSelection, type Extension } from '@codemirror/state'
import { createEditorExtensions, fontCompartment, fontTheme } from '../composables/useEditor'
import { useDocumentStore } from '../stores/document'
import { useThemeStore } from '../stores/theme'
import { useFontStore } from '../stores/font'
import { editorActions } from '../composables/useEditorActions'
import { oneDark } from '@codemirror/theme-one-dark'

const container = ref<HTMLElement | null>(null)
let view: EditorView | null = null
let suppressEmit = false

const doc = useDocumentStore()
const theme = useThemeStore()
const font = useFontStore()

const actions = ref<ReturnType<typeof editorActions> | null>(null)
const emit = defineEmits<{
  (e: 'ready', view: EditorView, actions: ReturnType<typeof editorActions>): void
  (e: 'scroll'): void
}>()

/**
 * 每个 Tab 的视图状态（滚动位置 + 选区）。
 * v0.4.8：切 Tab 不再销毁 EditorView，改用 setState 换文档，
 * 因此滚动位置、光标、撤销历史都能按 Tab 保留。
 */
interface ViewState {
  scrollTop: number
  from: number
  to: number
}
const viewStates = new Map<string, ViewState>()

function saveViewState(tabId: string) {
  if (!view || !tabId) return
  viewStates.set(tabId, {
    scrollTop: view.scrollDOM.scrollTop,
    from: view.state.selection.main.from,
    to: view.state.selection.main.to,
  })
}

function applyViewState(tabId: string) {
  if (!view) return
  const s = viewStates.get(tabId)
  if (!s) return
  const len = view.state.doc.length
  const from = Math.min(s.from, len)
  const to = Math.min(s.to, len)
  view.dispatch({ selection: EditorSelection.range(from, to) })
  // 等一轮布局再恢复滚动，避免被 setState 后的测量覆盖
  requestAnimationFrame(() => {
    if (view) view.scrollDOM.scrollTop = s.scrollTop
  })
}

function buildExtensions(): Extension[] {
  return [
    ...createEditorExtensions(
      (text) => {
        if (suppressEmit) return
        doc.setContent(text)
      },
      (line, col) => doc.setCursor(line, col),
    ),
  ]
}

/** 把当前 Tab 的文档装载进（已存在的）EditorView */
function swapTo(tabId: string, text: string) {
  if (!container.value) return
  const exts = buildExtensions()
  if (theme.current().isDark) exts.push(oneDark)
  const state = EditorState.create({ doc: text, extensions: exts })
  if (view) {
    view.setState(state)
  } else {
    view = new EditorView({ parent: container.value, state })
    view.scrollDOM.addEventListener('scroll', () => emit('scroll'), { passive: true })
  }
  actions.value = editorActions(view)
  applyViewState(tabId)
  emit('ready', view, actions.value)
}

function rebuild() {
  const tab = doc.activeTab
  if (!tab) return
  saveViewState(tab.id)
  swapTo(tab.id, tab.content)
}

onMounted(() => {
  rebuild()
  window.addEventListener('markwright:editor-cmd', onEditorCmd as EventListener)
  window.addEventListener('markwright:editor-jump-to', onJump as EventListener)
  window.addEventListener('markwright:jump-to-line', onJumpLine as EventListener)
  // 图片粘贴/拖入
  container.value?.addEventListener('paste', onPaste as unknown as EventListener)
  container.value?.addEventListener('drop', onDrop as unknown as EventListener)
  container.value?.addEventListener('dragover', onDragOver as unknown as EventListener)
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
  window.removeEventListener('markwright:editor-cmd', onEditorCmd as EventListener)
  window.removeEventListener('markwright:editor-jump-to', onJump as EventListener)
  window.removeEventListener('markwright:jump-to-line', onJumpLine as EventListener)
  container.value?.removeEventListener('paste', onPaste as unknown as EventListener)
  container.value?.removeEventListener('drop', onDrop as unknown as EventListener)
  container.value?.removeEventListener('dragover', onDragOver as unknown as EventListener)
})

// 切换 Tab：先保存旧 Tab 的滚动/选区，再换文档
watch(
  () => doc.activeId,
  (_next, prev) => {
    if (prev) saveViewState(prev)
    // 顺带清理已关闭 Tab 的残留状态，避免 Map 无限增长
    if (viewStates.size > 32) {
      const alive = new Set(doc.tabs.map((t) => t.id))
      for (const id of Array.from(viewStates.keys())) {
        if (!alive.has(id)) viewStates.delete(id)
      }
    }
    rebuild()
  }
)

// 内容由外部更新（如 loadFromPath）时同步到编辑器
watch(
  () => doc.activeTab?.content,
  (next) => {
    if (!view || next == null) return
    if (view.state.doc.toString() === next) return
    suppressEmit = true
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
    })
    suppressEmit = false
  }
)

defineExpose({
  getView: () => view,
  replaceAll: (text: string) => {
    if (!view) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
    })
  },
})

// 主题切换：简单重建（CodeMirror 6 切换 theme 用 Compartment 更好，先走重建）
watch(
  () => theme.currentId,
  () => rebuild()
)

// 字体设置变化（代码字体）：实时更新编辑器字体，无需重建
watch(
  () => font.mono,
  (fam) => {
    if (view) view.dispatch({ effects: fontCompartment.reconfigure(fontTheme(fam)) })
  }
)

/* ---------- 命令面板 / 全局搜索 / 跳转 事件 ---------- */

function onEditorCmd(e: Event) {
  const detail = (e as CustomEvent).detail
  if (!view) return
  const { cmd, text } = detail
  if (cmd === 'insertText' && text) {
    view.dispatch({
      changes: { from: view.state.selection.main.from, insert: text },
      selection: EditorSelection.cursor(view.state.selection.main.from + text.length),
    })
  } else if (cmd === 'duplicateLine') {
    const sel = view.state.selection.main
    const line = view.state.doc.lineAt(sel.from)
    view.dispatch({
      changes: { from: line.to, insert: '\n' + line.text },
      selection: EditorSelection.cursor(line.to + 1 + line.text.length),
    })
  } else if (cmd === 'deleteLine') {
    const sel = view.state.selection.main
    const line = view.state.doc.lineAt(sel.from)
    const from = line.from
    const to = sel.to > line.to ? view.state.doc.lineAt(sel.to).to : line.to
    view.dispatch({
      changes: { from, to: to + (line.to < view.state.doc.length ? 1 : 0) },
    })
  } else if (cmd === 'toggleComment') {
    // 简单 markdown 注释：在行首加/去掉 <!-- -->
    const sel = view.state.selection.main
    const line = view.state.doc.lineAt(sel.from)
    const isCommented = line.text.startsWith('<!--')
    if (isCommented) {
      view.dispatch({
        changes: { from: line.from, to: line.from + 4, insert: '' },
      })
    } else {
      view.dispatch({
        changes: { from: line.from, insert: '<!--' }, // 简化：仅插入开始
      })
    }
  } else if (cmd === 'prefixLine' && typeof text === 'string') {
    // 行首前缀（标题/列表/引用/任务），已存在则取消（可切换）
    const sel = view.state.selection.main
    const fromLine = view.state.doc.lineAt(sel.from)
    const toLine = view.state.doc.lineAt(sel.to)
    const changes: { from: number; to: number; insert: string }[] = []
    for (let i = fromLine.number; i <= toLine.number; i++) {
      const line = view.state.doc.line(i)
      if (line.text.startsWith(text)) {
        changes.push({ from: line.from, to: line.from + text.length, insert: '' })
      } else {
        changes.push({ from: line.from, to: line.from, insert: text })
      }
    }
    view.dispatch({ changes, scrollIntoView: true })
  } else if (cmd === 'renumberList') {
    // 手动重排当前列表段序号
    const doc = view.state.doc
    const sel = view.state.selection.main
    const lines: string[] = []
    for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text)
    const edits = computeRunRenumber(lines, doc.lineAt(sel.from).number)
    if (edits.length) {
      view.dispatch({
        changes: edits.map((e) => {
          const l = doc.line(e.line)
          return { from: l.from, to: l.to, insert: e.text }
        }),
      })
    }
  }
  view.focus()
}

function onJump(e: Event) {
  if (!view) return
  const { from, to } = (e as CustomEvent).detail
  view.dispatch({
    selection: EditorSelection.range(from, to),
  })
  // 滚动到可见
  const block = view.lineBlockAt(from)
  view.scrollDOM.scrollTo({ top: block.top - 40, behavior: 'smooth' })
  view.focus()
}

function onJumpLine(e: Event) {
  if (!view) return
  const { line: lineNo } = (e as CustomEvent).detail
  if (!lineNo || lineNo < 1) return
  const max = view.state.doc.lines
  const safe = Math.min(lineNo, max)
  const line = view.state.doc.line(safe)
  view.dispatch({
    selection: EditorSelection.cursor(line.from),
  })
  const block = view.lineBlockAt(line.from)
  view.scrollDOM.scrollTo({ top: block.top - 40, behavior: 'smooth' })
  view.focus()
}

/* ---------- 图片粘贴/拖入 ---------- */
import { useImageArchive } from '../composables/useImageArchive'
import { computeRunRenumber } from '../composables/useListRenumber'
const archiver = useImageArchive()

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  if (!e.dataTransfer) return
  for (const file of Array.from(e.dataTransfer.files)) {
    await archiver.paste(file)
  }
}

async function onPaste(e: ClipboardEvent) {
  if (!e.clipboardData) return
  for (const item of Array.from(e.clipboardData.items)) {
    if (item.kind === 'file') {
      const file = item.getAsFile()
      if (file) await archiver.paste(file)
    }
  }
}
</script>

<template>
  <div ref="container" class="editor-pane" />
</template>

<style scoped>
.editor-pane {
  height: 100%;
  background: var(--bg-0);
  overflow: hidden;
}
.editor-pane :deep(.cm-editor) {
  height: 100%;
}
</style>
