/**
 * Slash 命令菜单（CodeMirror 6 扩展）
 * 在编辑器输入 `/`（行首或空白后）弹出语法快捷菜单，可筛选并插入任意 Markdown 语法片段。
 * - 键盘：↑/↓ 选择，Enter / Tab 插入，Esc 关闭
 * - 鼠标：悬浮高亮，点击插入
 * 片段中 `${cursor}` 标记插入后光标落点。
 */
import { Prec, StateField, StateEffect, EditorSelection, EditorState, type Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view'

/** 单个语法命令 */
interface SlashCommand {
  id: string
  title: string
  /** 别名/关键词，用于筛选（支持中文与英文） */
  keywords: string[]
  /** 插入的文本，`${cursor}` 标记光标落点 */
  snippet: string
}

const CURSOR = '${cursor}'

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'h1', title: '一级标题', keywords: ['h1', '标题', 'heading', 'bt'], snippet: '# ${cursor}' },
  { id: 'h2', title: '二级标题', keywords: ['h2', '标题', 'heading', 'bt'], snippet: '## ${cursor}' },
  { id: 'h3', title: '三级标题', keywords: ['h3', '标题', 'heading'], snippet: '### ${cursor}' },
  { id: 'h4', title: '四级标题', keywords: ['h4', '标题'], snippet: '#### ${cursor}' },
  { id: 'h5', title: '五级标题', keywords: ['h5', '标题'], snippet: '##### ${cursor}' },
  { id: 'h6', title: '六级标题', keywords: ['h6', '标题'], snippet: '###### ${cursor}' },
  { id: 'bold', title: '粗体', keywords: ['bold', '粗体', 'cu'], snippet: '**${cursor}**' },
  { id: 'italic', title: '斜体', keywords: ['italic', '斜体', 'xt'], snippet: '*${cursor}*' },
  { id: 'strike', title: '删除线', keywords: ['strike', '删除线', 'sc'], snippet: '~~${cursor}~~' },
  { id: 'inlinecode', title: '行内代码', keywords: ['code', '代码', 'dm'], snippet: '`${cursor}`' },
  { id: 'codeblock', title: '代码块', keywords: ['code', '代码块', 'fence', 'dy'], snippet: '```\n${cursor}\n```' },
  { id: 'quote', title: '引用', keywords: ['quote', '引用', 'yy'], snippet: '> ${cursor}' },
  { id: 'ul', title: '无序列表', keywords: ['ul', 'list', '列表', 'wx'], snippet: '- ${cursor}' },
  { id: 'ol', title: '有序列表', keywords: ['ol', '有序', '列表'], snippet: '1. ${cursor}' },
  { id: 'task', title: '任务列表', keywords: ['task', '任务', '待办', 'checkbox'], snippet: '- [ ] ${cursor}' },
  { id: 'hr', title: '分割线', keywords: ['hr', '分割线', 'fg', 'line'], snippet: '\n---\n${cursor}' },
  { id: 'link', title: '链接', keywords: ['link', '链接', 'lj'], snippet: '[${cursor}](https://)' },
  { id: 'image', title: '图片', keywords: ['image', '图片', 'img', 'tp'], snippet: '![${cursor}](https://)' },
  { id: 'table', title: '表格', keywords: ['table', '表格', 'bg'], snippet: '| 列1 | 列2 |\n| --- | --- |\n| ${cursor} |  |' },
  { id: 'math', title: '公式块', keywords: ['math', '公式', 'katex', 'latex'], snippet: '$$\n${cursor}\n$$' },
  { id: 'toc', title: '目录', keywords: ['toc', '目录', 'ml'], snippet: '[TOC]\n' },
]

interface SlashState {
  /** `/` 的位置 */
  from: number
  /** 光标（查询词结尾）位置 */
  to: number
  query: string
  items: SlashCommand[]
  active: number
}

const setActive = StateEffect.define<number>()
const closeSlash = StateEffect.define<null>()

function filterCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS
  const q = query.toLowerCase()
  return SLASH_COMMANDS.filter(
    (c) => c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.toLowerCase().includes(q)),
  )
}

function computeSlash(state: EditorState): SlashState | null {
  const sel = state.selection.main
  if (!sel.empty) return null
  const pos = sel.head
  const line = state.doc.lineAt(pos)
  const textBefore = state.sliceDoc(line.from, pos)
  // 取光标前最后一个 `/` 作为触发点
  const slash = textBefore.lastIndexOf('/')
  if (slash === -1) return null
  const query = textBefore.slice(slash + 1)
  // 查询词包含空格则视为普通输入，关闭菜单
  if (/\s/.test(query)) return null
  // `/` 前的字符：行首、空白、或非 ASCII（中文/中文标点）才触发，
  // 避免英文路径 `a/b`、URL `http://` 误触发
  const before = slash > 0 ? textBefore[slash - 1] : ''
  const okBefore =
    slash === 0 || before === ' ' || before === '\t' || before.charCodeAt(0) > 127
  if (!okBefore) return null
  const from = line.from + slash
  const items = filterCommands(query)
  if (items.length === 0) return null
  return { from, to: pos, query, items, active: 0 }
}

const slashField = StateField.define<SlashState | null>({
  create() {
    return null
  },
  update(value, tr) {
    const prevHead = tr.startState.selection.main.head
    // 选区未变化的事务 tr.selection 为 undefined，此时 head 视为不变
    const curHead = tr.selection ? tr.selection.main.head : prevHead
    if (tr.docChanged || prevHead !== curHead) return computeSlash(tr.state)
    if (!value) return null
    for (const e of tr.effects) {
      if (e.is(setActive)) {
        const active = Math.max(0, Math.min(value.items.length - 1, e.value))
        return { ...value, active }
      }
      if (e.is(closeSlash)) return null
    }
    return value
  },
})

function applyCommand(view: EditorView, st: SlashState) {
  const cmd = st.items[st.active]
  if (!cmd) return
  const i = cmd.snippet.indexOf(CURSOR)
  let insert = cmd.snippet
  let cursorOffset = cmd.snippet.length
  if (i >= 0) {
    insert = cmd.snippet.slice(0, i) + cmd.snippet.slice(i + CURSOR.length)
    cursorOffset = i
  }
  view.dispatch({
    changes: { from: st.from, to: st.to, insert },
    selection: EditorSelection.cursor(st.from + cursorOffset),
    scrollIntoView: true,
  })
  view.focus()
}

function ensureStyle() {
  if (document.getElementById('mw-slash-style')) return
  const css = `
.mw-slash-menu {
  position: fixed;
  z-index: 9999;
  min-width: 240px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-elevated, #2d333b);
  color: var(--fg-0, #e6edf3);
  border: 1px solid var(--border-0, #30363d);
  border-radius: var(--radius-md, 6px);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.5));
  padding: 4px;
  font-family: var(--font-sans);
  font-size: var(--fz-sm, 12px);
}
.mw-slash-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  white-space: nowrap;
}
.mw-slash-item.active,
.mw-slash-item:hover {
  background: var(--accent-soft, rgba(88, 166, 255, 0.16));
}
.mw-slash-item .mw-slash-title { font-weight: 600; }
.mw-slash-item .mw-slash-sample {
  margin-left: auto;
  padding-left: 16px;
  color: var(--fg-2, #8b949e);
  font-family: var(--font-mono);
  font-size: var(--fz-xs, 11px);
}
.mw-slash-empty { padding: 8px; color: var(--fg-3, #6e7681); }
`
  const el = document.createElement('style')
  el.id = 'mw-slash-style'
  el.textContent = css
  document.head.appendChild(el)
}

function renderList(dom: HTMLElement, view: EditorView, st: SlashState) {
  dom.innerHTML = ''
  st.items.forEach((cmd, index) => {
    const item = document.createElement('div')
    item.className = 'mw-slash-item' + (index === st.active ? ' active' : '')
    const title = document.createElement('span')
    title.className = 'mw-slash-title'
    title.textContent = cmd.title
    const sample = document.createElement('span')
    sample.className = 'mw-slash-sample'
    sample.textContent = cmd.snippet.replace(CURSOR, '').trim()
    item.append(title, sample)
    item.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      applyCommand(view, { ...st, active: index })
    })
    item.addEventListener('mouseenter', () => {
      if (st.active !== index) view.dispatch({ effects: setActive.of(index) })
    })
    dom.appendChild(item)
  })
  const activeEl = dom.querySelector('.mw-slash-item.active')
  activeEl?.scrollIntoView({ block: 'nearest' })
}

const slashPlugin = ViewPlugin.fromClass(
  class {
    dom: HTMLElement
    view: EditorView
    onDocDown = (e: MouseEvent) => {
      if (this.view.state.field(slashField) && !(e.target as HTMLElement)?.closest('.mw-slash-menu')) {
        this.view.dispatch({ effects: closeSlash.of(null) })
      }
    }
    constructor(view: EditorView) {
      this.view = view
      ensureStyle()
      this.dom = document.createElement('div')
      this.dom.className = 'mw-slash-menu'
      this.dom.style.display = 'none'
      document.body.appendChild(this.dom)
      document.addEventListener('mousedown', this.onDocDown, true)
      this.sync(view)
    }
    update(update: ViewUpdate) {
      this.sync(update.view)
    }
    sync(view: EditorView) {
      const st = view.state.field(slashField)
      if (!st) {
        this.dom.style.display = 'none'
        return
      }
      this.dom.style.display = ''
      renderList(this.dom, view, st)
      // 读布局必须在测量阶段进行（update 期间禁止），否则插件会崩溃
      view.requestMeasure({
        read: () => view.coordsAtPos(st.from),
        write: (coords) => {
          if (!coords) return
          const width = this.dom.offsetWidth
          const height = this.dom.offsetHeight
          let left = coords.left
          let top = coords.bottom + 4
          if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
          if (top + height > window.innerHeight - 8) top = coords.top - height - 4
          this.dom.style.left = `${Math.max(8, left)}px`
          this.dom.style.top = `${Math.max(8, top)}px`
        },
      })
    }
    destroy() {
      document.removeEventListener('mousedown', this.onDocDown, true)
      this.dom.remove()
    }
  },
)

const slashKeymap = Prec.highest(
  keymap.of([
    {
      key: 'ArrowDown',
      run: (v) => {
        const st = v.state.field(slashField)
        if (!st) return false
        v.dispatch({ effects: setActive.of((st.active + 1) % st.items.length) })
        return true
      },
    },
    {
      key: 'ArrowUp',
      run: (v) => {
        const st = v.state.field(slashField)
        if (!st) return false
        v.dispatch({ effects: setActive.of((st.active - 1 + st.items.length) % st.items.length) })
        return true
      },
    },
    {
      key: 'Enter',
      run: (v) => {
        const st = v.state.field(slashField)
        if (!st) return false
        applyCommand(v, st)
        return true
      },
    },
    {
      key: 'Tab',
      run: (v) => {
        const st = v.state.field(slashField)
        if (!st) return false
        applyCommand(v, st)
        return true
      },
    },
    {
      key: 'Escape',
      run: (v) => {
        const st = v.state.field(slashField)
        if (!st) return false
        v.dispatch({ effects: closeSlash.of(null) })
        return true
      },
    },
  ]),
)

/** 注入到编辑器的 slash 菜单扩展集合 */
export function slashMenu(): Extension[] {
  return [slashField, slashPlugin, slashKeymap]
}
