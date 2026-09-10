/**
 * CodeMirror 6 编辑器构造
 * - markdown 语言支持
 * - 行号、当前行高亮、选区、括号匹配
 * - 搜索、撤销/重做、history
 * - 快捷键：Ctrl/Cmd+B 加粗、I 斜体、K 链接、Shift+Tab/列表、S 保存等
 */
import { Compartment, EditorSelection, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
  lineNumbers,
  rectangularSelection,
  crosshairCursor,
  dropCursor,
} from '@codemirror/view'
import {
  history,
  defaultKeymap,
  historyKeymap,
  indentWithTab,
} from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import {
  bracketMatching,
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  foldGutter,
  foldKeymap,
} from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
// 暗色主题由 EditorPane 在主题切换时整包传入

import { useFontStore } from '../stores/font'
import { slashMenu } from './useSlashMenu'
import { orderedListRenumber } from './useListRenumber'

/** 字体 compartment：编辑区字体跟随全局字体设置（代码字体），可热更新 */
export const fontCompartment = new Compartment()

/** 根据字体族构造 CodeMirror 字体主题 */
export function fontTheme(family: string): Extension {
  return EditorView.theme({
    '&': { fontFamily: family },
    '.cm-scroller': { fontFamily: family },
  })
}


/** 在选区两端包裹字符串；无选区时插入占位并选中 */
function wrap(view: EditorView, before: string, after: string, placeholder = '') {
  const { state } = view
  const tr = state.changeByRange((range) => {
    if (range.empty) {
      const insert = `${before}${placeholder}${after}`
      return {
        changes: { from: range.from, insert },
        range: EditorSelection.range(
          range.from + before.length,
          range.from + before.length + placeholder.length
        ),
      }
    }
    const selected = state.sliceDoc(range.from, range.to)
    return {
      changes: { from: range.from, to: range.to, insert: `${before}${selected}${after}` },
      range: EditorSelection.range(range.from + before.length, range.to + before.length),
    }
  })
  view.dispatch({ ...tr, selection: tr.selection, scrollIntoView: true })
  view.focus()
}

/** 在行首加前缀（用于标题/列表） */
function prefixLines(view: EditorView, prefix: string) {
  const { state } = view
  const tr = state.changeByRange((range) => {
    const fromLine = state.doc.lineAt(range.from)
    const toLine = state.doc.lineAt(range.to)
    const updates: { from: number; to: number; insert: string }[] = []
    for (let i = fromLine.number; i <= toLine.number; i++) {
      const line = state.doc.line(i)
      updates.push({ from: line.from, to: line.from, insert: prefix })
    }
    return { changes: updates, range }
  })
  view.dispatch({ ...tr, scrollIntoView: true })
  view.focus()
}

export function createEditorExtensions(onChange: (text: string) => void, onCursor: (line: number, col: number) => void): Extension[] {
  const themeCompartment = new Compartment()

  const baseExtensions: Extension[] = [
    lineNumbers(),
    foldGutter(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    highlightSelectionMatches(),
    history(),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
      indentWithTab,
    ]),
    rectangularSelection(),
    crosshairCursor(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: () => null }),
    // 有序列表自动重编号（删/改序号后顺延补位）
    orderedListRenumber(),
    themeCompartment.of([]),
    fontCompartment.of(fontTheme(useFontStore().mono)),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString())
      }
      if (update.selectionSet) {
        const head = update.state.selection.main.head
        const line = update.state.doc.lineAt(head)
        onCursor(line.number, head - line.from + 1)
      }
    }),
    // 主题切换时同步
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
    }),
  ]

  // 工具栏/快捷键触发的命令
  const editorCommands: Extension[] = [
    EditorView.domEventHandlers({}),
    keymap.of([
      {
        key: 'Mod-b',
        run: (v) => { wrap(v, '**', '**', '加粗文本'); return true },
      },
      {
        key: 'Mod-i',
        run: (v) => { wrap(v, '*', '*', '斜体文本'); return true },
      },
      {
        key: 'Mod-k',
        run: (v) => { wrap(v, '[', '](https://)', '链接文本'); return true },
      },
      {
        key: 'Mod-Shift-7',
        run: (v) => { prefixLines(v, '1. '); return true },
      },
      {
        key: 'Mod-Shift-8',
        run: (v) => { prefixLines(v, '- '); return true },
      },
      {
        key: 'Mod-Shift-9',
        run: (v) => { prefixLines(v, '> '); return true },
      },
    ]),
  ]

  return [...baseExtensions, ...editorCommands, ...slashMenu()]
}
