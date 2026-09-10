/**
 * 有序列表自动重编号
 *
 * 规则（以「本次改动所在行」为锚点）：
 *  - 同缩进层级、连续的有序项构成一个「列表段」；
 *  - **就地修改某一项序号**：该项保留用户输入的数字，其后各项依次 +1
 *    （例：`1. 2. 3.` 把第 2 项改成 `5.` → `1. 5. 6.`）；
 *  - **整行删除**：删除点之前的项不动，删除点及其后各项顺延补位
 *    （例：删掉第 2 项 → `1. 2.`；删掉第 1 项 → `1. 2.`）。
 *
 * 只在确实产生差异时才派发，避免与用户输入互相触发死循环。
 */
import { EditorState, type Extension } from '@codemirror/state'

export interface OrderedItem {
  indent: string
  num: number
  delim: string
  gap: string
  body: string
}

const ORDERED_RE = /^(\s*)(\d{1,9})([.)])(\s+)(.*)$/

/** 解析一行是否为有序列表项 */
export function parseOrdered(line: string): OrderedItem | null {
  const m = ORDERED_RE.exec(line)
  if (!m) return null
  return { indent: m[1], num: Number(m[2]), delim: m[3], gap: m[4], body: m[5] }
}

export interface RenumberEdit {
  /** 1-based 行号 */
  line: number
  /** 该行重写后的完整文本 */
  text: string
}

/**
 * 计算需要改写的行。
 * @param lines       当前文档按行拆分
 * @param changedLine 改动所在行（1-based）
 * @param lineDeleted 本次改动是否「删掉了整行」（删除内容含换行且未插入换行）
 */
export function computeOrderedRenumber(
  lines: string[],
  changedLine: number,
  lineDeleted: boolean,
): RenumberEdit[] {
  const idx = changedLine - 1
  if (idx < 0 || idx >= lines.length) return []
  const anchor = parseOrdered(lines[idx])
  if (!anchor) return []

  const indent = anchor.indent

  // 列表段起点
  let start = idx
  while (start > 0) {
    const prev = parseOrdered(lines[start - 1])
    if (!prev || prev.indent !== indent) break
    start--
  }
  // 列表段终点
  let end = idx
  while (end + 1 < lines.length) {
    const next = parseOrdered(lines[end + 1])
    if (!next || next.indent !== indent) break
    end++
  }

  let from: number
  let startNum: number
  if (lineDeleted) {
    // 整行删除：从列表段起点补位；若删除点就在段首则从 1 重新开始
    from = start
    startNum = changedLine <= start + 1 ? 1 : (parseOrdered(lines[start])?.num ?? 1)
  } else if (idx > start) {
    // 就地改号：改动行成为新锚点，保留用户输入的数字
    from = idx
    startNum = anchor.num
  } else {
    from = start
    startNum = anchor.num
  }

  const edits: RenumberEdit[] = []
  for (let i = from; i <= end; i++) {
    const item = parseOrdered(lines[i])
    if (!item) break
    const want = startNum + (i - from)
    if (item.num === want) continue
    edits.push({ line: i + 1, text: `${item.indent}${want}${item.delim}${item.gap}${item.body}` })
  }
  return edits
}

/**
 * 手动重排：以当前行所在「列表段」的段首为锚点，整段顺延。
 * 用于菜单/命令面板里的「重排有序列表序号」。
 */
export function computeRunRenumber(lines: string[], lineNumber: number): RenumberEdit[] {
  const idx = lineNumber - 1
  if (idx < 0 || idx >= lines.length) return []
  const anchor = parseOrdered(lines[idx])
  if (!anchor) return []
  let start = idx
  while (start > 0) {
    const prev = parseOrdered(lines[start - 1])
    if (!prev || prev.indent !== anchor.indent) break
    start--
  }
  return computeOrderedRenumber(lines, start + 1, false)
}

/** 单次改动允许的最大字符数；超过视为整文档替换（打开文件/切 Tab），不参与重编号 */
const MAX_CHANGE_CHARS = 2000
/** 单次改动允许跨越的最大行数 */
const MAX_CHANGE_LINES = 30

/**
 * CodeMirror 扩展：文档变更后自动重编号有序列表。
 *
 * 用 `transactionFilter` 而非 ViewPlugin：过滤阶段可以把「重编号」作为**同一事务的后续变更**
 * 追加进去，一次编辑一次历史记录；而 ViewPlugin 在 update 期间是不允许再派发事务的。
 * 仅在「改动落在有序列表段内」且「确实需要改写」时才追加变更。
 */
export function orderedListRenumber(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr

    const startDoc = tr.startState.doc
    let from = -1
    let to = -1
    let newFrom = -1
    let newTo = -1
    let huge = false
    tr.changes.iterChanges((fromA, toA, fromB, toB) => {
      if (from >= 0) return
      from = fromA
      to = toA
      newFrom = fromB
      newTo = toB
      if (toA - fromA > MAX_CHANGE_CHARS) huge = true
    })
    if (huge || from < 0) return tr

    // 整文档替换（打开文件 / 切 Tab / 全选粘贴）：不参与重编号
    if (from === 0 && to === startDoc.length && startDoc.length > 0) return tr

    const doc = tr.newDoc
    const oldText = startDoc.sliceString(from, to)
    const newText = doc.sliceString(newFrom, newTo)
    if (oldText.split('\n').length > MAX_CHANGE_LINES) return tr
    if (newText.split('\n').length > MAX_CHANGE_LINES) return tr

    const lineDeleted = oldText.includes('\n') && !newText.includes('\n')
    const pos = Math.min(newFrom, doc.length)
    const changedLine = doc.lineAt(pos).number

    const lines: string[] = []
    for (let i = 1; i <= doc.lines; i++) lines.push(doc.line(i).text)

    const edits = computeOrderedRenumber(lines, changedLine, lineDeleted)
    if (!edits.length) return tr

    const changes = edits.map((e) => {
      const l = doc.line(e.line)
      return { from: l.from, to: l.to, insert: e.text }
    })
    // 返回数组 = 原事务 + 追加的变更；sequential 表示后续 spec 的坐标基于前一 spec 之后的状态
    return [tr, { changes, sequential: true }]
  })
}

