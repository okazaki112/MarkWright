/**
 * Kanban 看板 - 拖拽列与卡片
 * - HTML5 drag & drop API（不引入第三方库）
 * - 数据模型：columns = [{ name, cards: [{ text, done }] }]
 * - 改回 markdown：纯文本，无样式
 *
 * v0.4.8：
 *  1. renderKanban 返回 unmount，调用方（useRenderer.dispose）负责释放，
 *     不再每次预览刷新泄漏一整个 Vue 应用实例
 *  2. 解析器重写：支持缩进卡片、* / + 项目符号、- [x|X] 勾选、
 *     出现在任何列之前的孤儿卡片（归入「待办」）；卡片文本中的 `]` 不再截断
 *  3. 同一容器重复渲染时先卸载旧实例
 */
import { ref } from 'vue'
import './useKanbanStyle'

interface Card {
  id: number
  text: string
  done: boolean
}
interface Column {
  id: number
  name: string
  cards: Card[]
}
interface BoardData {
  title: string
  columns: Column[]
}

let idCounter = 1
function nextId() { return idCounter++ }

const BULLET_RE = /^\s*[-*+]\s+/
const TASK_RE = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/
const COLUMN_RE = /^#{1,6}\s+(.+?)\s*#*\s*$/

function parse(text: string): BoardData {
  const lines = text.split('\n')
  const columns: Column[] = []
  let current: Column | null = null

  const ensureDefault = (): Column => {
    if (!current) {
      current = { id: nextId(), name: '待办', cards: [] }
      columns.push(current)
    }
    return current
  }

  for (const raw of lines) {
    if (!raw.trim()) continue

    const colMatch = raw.match(COLUMN_RE)
    if (colMatch) {
      current = { id: nextId(), name: colMatch[1].trim(), cards: [] }
      columns.push(current)
      continue
    }

    // 任务卡片：- [ ] text / * [x] text（可缩进）
    const task = raw.match(TASK_RE)
    if (task) {
      ensureDefault().cards.push({
        id: nextId(),
        done: task[1] !== ' ',
        text: task[2].trim(),
      })
      continue
    }

    // 普通卡片
    if (BULLET_RE.test(raw)) {
      ensureDefault().cards.push({
        id: nextId(),
        done: false,
        text: raw.replace(BULLET_RE, '').trim(),
      })
    }
  }

  if (columns.length === 0) {
    columns.push(
      { id: nextId(), name: '待办', cards: [] },
      { id: nextId(), name: '进行中', cards: [] },
      { id: nextId(), name: '完成', cards: [] },
    )
  }
  return { title: '', columns }
}

function serialize(board: BoardData): string {
  const lines: string[] = []
  for (const col of board.columns) {
    lines.push(`# ${col.name}`)
    for (const c of col.cards) {
      lines.push(`- [${c.done ? 'x' : ' '}] ${c.text}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim() + '\n'
}

const KanbanBoard = {
  props: {
    initial: { type: String, required: true },
  },
  emits: ['change'],
  setup(props: { initial: string }, { emit }: { emit: (e: 'change', s: string) => void }) {
    const board = ref<BoardData>(parse(props.initial))
    const dragId = ref<number | null>(null)
    const dragFromCol = ref<number | null>(null)

    function emitChange() {
      emit('change', serialize(board.value))
    }

    function addColumn() {
      const name = prompt('新列名')
      if (name && name.trim()) {
        board.value.columns.push({ id: nextId(), name: name.trim(), cards: [] })
        emitChange()
      }
    }

    function deleteColumn(colId: number) {
      const col = board.value.columns.find((c) => c.id === colId)
      if (!col) return
      if (confirm(`删除列「${col.name}」？该列下的卡片也会被删除。`)) {
        board.value.columns = board.value.columns.filter((c) => c.id !== colId)
        emitChange()
      }
    }

    function renameColumn(colId: number) {
      const col = board.value.columns.find((c) => c.id === colId)
      if (!col) return
      const name = prompt('新列名', col.name)
      if (name && name.trim()) {
        col.name = name.trim()
        emitChange()
      }
    }

    function addCard(colId: number) {
      const text = prompt('新卡片')
      if (text && text.trim()) {
        const col = board.value.columns.find((c) => c.id === colId)
        if (col) {
          col.cards.push({ id: nextId(), done: false, text: text.trim() })
          emitChange()
        }
      }
    }

    function deleteCard(colId: number, cardId: number) {
      const col = board.value.columns.find((c: Column) => c.id === colId)
      if (!col) return
      col.cards = col.cards.filter((c: Card) => c.id !== cardId)
      emitChange()
    }

    function toggleCard(colId: number, cardId: number) {
      const col = board.value.columns.find((c: Column) => c.id === colId)
      if (!col) return
      const c = col.cards.find((c: Card) => c.id === cardId)
      if (c) {
        c.done = !c.done
        emitChange()
      }
    }

    function onDragStart(e: DragEvent, colId: number, cardId: number) {
      dragId.value = cardId
      dragFromCol.value = colId
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(cardId))
      }
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    }
    function onDrop(e: DragEvent, toColId: number, beforeCardId?: number) {
      e.preventDefault()
      const cardId = dragId.value
      const fromColId = dragFromCol.value
      if (cardId == null || fromColId == null) return
      const fromCol = board.value.columns.find((c: Column) => c.id === fromColId)
      const toCol = board.value.columns.find((c: Column) => c.id === toColId)
      if (!fromCol || !toCol) return
      const idx = fromCol.cards.findIndex((c: Card) => c.id === cardId)
      if (idx < 0) return
      const [card] = fromCol.cards.splice(idx, 1)
      if (beforeCardId == null) {
        toCol.cards.push(card)
      } else {
        const insertAt = toCol.cards.findIndex((c: Card) => c.id === beforeCardId)
        toCol.cards.splice(insertAt >= 0 ? insertAt : toCol.cards.length, 0, card)
      }
      emitChange()
      dragId.value = null
      dragFromCol.value = null
    }

    return {
      board, dragId,
      addColumn, deleteColumn, renameColumn,
      addCard, deleteCard, toggleCard,
      onDragStart, onDragOver, onDrop,
    }
  },
  template: `
    <div class="kanban-host">
      <div class="kanban-board">
        <div
          v-for="col in board.columns"
          :key="col.id"
          class="kcol"
          @dragover="onDragOver($event)"
          @drop="onDrop($event, col.id)"
        >
          <div class="kcol-header">
            <span class="kcol-name">{{ col.name }}</span>
            <span class="kcol-count">{{ col.cards.length }}</span>
            <button class="kbtn" @click="renameColumn(col.id)" title="重命名">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="kbtn danger" @click="deleteColumn(col.id)" title="删除列">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
          <div class="kcol-body">
            <div
              v-for="card in col.cards"
              :key="card.id"
              class="kcard"
              :class="{ done: card.done, drag: dragId === card.id }"
              draggable="true"
              @dragstart="onDragStart($event, col.id, card.id)"
              @dragover="onDragOver($event)"
              @drop.stop="onDrop($event, col.id, card.id)"
            >
              <input
                type="checkbox"
                :checked="card.done"
                @change="toggleCard(col.id, card.id)"
              />
              <span class="ktext">{{ card.text }}</span>
              <button class="kbtn danger small" @click="deleteCard(col.id, card.id)" title="删除">
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <button class="kadd-card" @click="addCard(col.id)">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              添加卡片
            </button>
          </div>
        </div>
        <button class="kadd-col" @click="addColumn">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          新建列
        </button>
      </div>
    </div>
  `,
}

/** 容器 → 已挂载的 app，防止重复挂载泄漏 */
const mounted = new WeakMap<HTMLElement, { unmount: () => void }>()

/**
 * 异步渲染入口：useRenderer 调到这里
 * @returns unmount 函数，必须调用以释放 Vue 实例
 */
export async function renderKanban(
  container: HTMLElement,
  initial: string,
  onChange: (s: string) => void,
): Promise<() => void> {
  const prev = mounted.get(container)
  if (prev) {
    try { prev.unmount() } catch { /* ignore */ }
    mounted.delete(container)
  }
  container.innerHTML = ''
  const { createApp, h } = await import('vue')
  const app = createApp({
    setup() {
      return () => h(KanbanBoard, { initial, 'onChange': (s: string) => onChange(s) })
    },
  })
  app.mount(container)
  const unmount = () => {
    try { app.unmount() } catch { /* ignore */ }
    mounted.delete(container)
    container.innerHTML = ''
  }
  mounted.set(container, { unmount })
  return unmount
}

/** 纯解析器（导出用于测试） */
export function parseKanban(text: string): BoardData {
  return parse(text)
}

/** 纯序列化器（导出用于测试） */
export function serializeKanban(board: BoardData): string {
  return serialize(board)
}

export function serializeBoard(text: string): string {
  return serialize(parse(text))
}
