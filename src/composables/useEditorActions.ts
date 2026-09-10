/**
 * 工具栏插入动作（被工具栏按钮触发）
 * 需在 CodeMirror view 已就绪时调用
 */
import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { undo, redo } from '@codemirror/commands'

function wrap(view: EditorView, before: string, after: string, placeholder = '') {
  const { state } = view
  const sel = state.selection.main
  let insertText: string
  let newSel: { anchor: number; head: number }
  if (sel.empty) {
    insertText = `${before}${placeholder}${after}`
    newSel = { anchor: sel.from + before.length, head: sel.from + before.length + placeholder.length }
  } else {
    const selected = state.sliceDoc(sel.from, sel.to)
    insertText = `${before}${selected}${after}`
    newSel = { anchor: sel.from + before.length, head: sel.to + before.length }
  }
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: insertText },
    selection: EditorSelection.range(newSel.anchor, newSel.head),
    scrollIntoView: true,
  })
  view.focus()
}

function prefixLines(view: EditorView, prefix: string) {
  const { state } = view
  const sel = state.selection.main
  const fromLine = state.doc.lineAt(sel.from)
  const toLine = state.doc.lineAt(sel.to)
  const changes: { from: number; to: number; insert: string }[] = []
  for (let i = fromLine.number; i <= toLine.number; i++) {
    const line = state.doc.line(i)
    changes.push({ from: line.from, to: line.from, insert: prefix })
  }
  view.dispatch({ changes, scrollIntoView: true })
  view.focus()
}

function insertBlock(view: EditorView, text: string) {
  const { state } = view
  const sel = state.selection.main
  view.dispatch({
    changes: { from: sel.from, insert: text },
    selection: EditorSelection.cursor(sel.from + text.length),
    scrollIntoView: true,
  })
  view.focus()
}

export function editorActions(view: EditorView | null) {
  return {
    bold: () => view && wrap(view, '**', '**', '加粗文本'),
    italic: () => view && wrap(view, '*', '*', '斜体文本'),
    strike: () => view && wrap(view, '~~', '~~', '删除线'),
    code: () => view && wrap(view, '`', '`', 'code'),
    link: () => view && wrap(view, '[', '](https://)', '链接文本'),
    image: () => view && wrap(view, '![', '](https://)', '图片描述'),
    h1: () => view && prefixLines(view, '# '),
    h2: () => view && prefixLines(view, '## '),
    h3: () => view && prefixLines(view, '### '),
    ul: () => view && prefixLines(view, '- '),
    ol: () => view && prefixLines(view, '1. '),
    task: () => view && prefixLines(view, '- [ ] '),
    quote: () => view && prefixLines(view, '> '),
    codeBlock: () => view && insertBlock(view, '\n```ts\n// your code here\n```\n'),
    table: () => view && insertBlock(view, '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n'),
    hr: () => view && insertBlock(view, '\n---\n'),
    undo: () => view && undo(view),
    redo: () => view && redo(view),
  }
}

export type EditorActions = ReturnType<typeof editorActions>
