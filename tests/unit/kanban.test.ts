import { describe, it, expect } from 'vitest'
import { parseKanban, serializeKanban } from '../../src/composables/useKanban'

describe('parseKanban', () => {
  it('parses columns and task cards with done state', () => {
    const md = '# 待办\n- [ ] 任务一\n- [x] 已完成\n# 进行中\n- 普通卡片'
    const board = parseKanban(md)
    expect(board.columns[0].name).toBe('待办')
    expect(board.columns[0].cards).toHaveLength(2)
    expect(board.columns[0].cards[0].done).toBe(false)
    expect(board.columns[0].cards[1].done).toBe(true)
    expect(board.columns[1].name).toBe('进行中')
    expect(board.columns[1].cards[0].done).toBe(false)
  })

  it('puts orphan cards into a default 待办 column', () => {
    const board = parseKanban('- [ ] 孤儿')
    expect(board.columns).toHaveLength(1)
    expect(board.columns[0].name).toBe('待办')
    expect(board.columns[0].cards[0].text).toBe('孤儿')
  })

  it('yields three default columns for empty input', () => {
    const board = parseKanban('')
    expect(board.columns.map((c) => c.name)).toEqual(['待办', '进行中', '完成'])
  })

  it('supports indented and various bullet markers', () => {
    const board = parseKanban('  * [x] a\n+ b')
    expect(board.columns[0].cards[0].done).toBe(true)
    expect(board.columns[0].cards[0].text).toBe('a')
    expect(board.columns[0].cards[1].text).toBe('b')
  })
})

describe('serializeKanban', () => {
  it('round-trips through parse preserving columns and done flags', () => {
    const md = '# 待办\n- [ ] a\n- [x] b\n# 进行中\n- c'
    const out = serializeKanban(parseKanban(md))
    const again = parseKanban(out)
    expect(again.columns.map((c) => c.name)).toEqual(['待办', '进行中'])
    expect(again.columns[0].cards.map((c) => c.text)).toEqual(['a', 'b'])
    expect(again.columns[0].cards.map((c) => c.done)).toEqual([false, true])
  })
})
