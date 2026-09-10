import { describe, it, expect } from 'vitest'
import {
  parseOrdered,
  computeOrderedRenumber,
  computeRunRenumber,
} from '../../src/composables/useListRenumber'

describe('parseOrdered', () => {
  it('parses dot and paren markers with indentation', () => {
    expect(parseOrdered('1. a')).toMatchObject({ indent: '', num: 1, delim: '.', body: 'a' })
    expect(parseOrdered('  12) b')).toMatchObject({ indent: '  ', num: 12, delim: ')', body: 'b' })
  })

  it('parses an empty item', () => {
    expect(parseOrdered('3. ')).toMatchObject({ num: 3, body: '' })
  })

  it('rejects non ordered-list lines', () => {
    expect(parseOrdered('- a')).toBeNull()
    expect(parseOrdered('> quote')).toBeNull()
    expect(parseOrdered('plain text')).toBeNull()
    expect(parseOrdered('1.no-space')).toBeNull()
  })
})

describe('computeOrderedRenumber', () => {
  it('re-numbers following items after a whole-line deletion', () => {
    // 删除原第 2 项后，文档变为 ["1. a", "3. c"]，光标落在第 2 行
    const edits = computeOrderedRenumber(['1. a', '3. c'], 2, true)
    expect(edits).toEqual([{ line: 2, text: '2. c' }])
  })

  it('restarts at 1 when the first item is deleted', () => {
    const edits = computeOrderedRenumber(['2. b', '3. c'], 1, true)
    expect(edits).toEqual([
      { line: 1, text: '1. b' },
      { line: 2, text: '2. c' },
    ])
  })

  it('keeps a hand-edited number and shifts the rest', () => {
    // 把第 2 项改成 5. → 后续变为 6.
    const edits = computeOrderedRenumber(['1. a', '5. b', '3. c'], 2, false)
    expect(edits).toEqual([{ line: 3, text: '6. c' }])
  })

  it('produces no edits when numbering is already sequential', () => {
    // 回车新建第 4 项后：1,2,3,4 无需改写
    expect(computeOrderedRenumber(['1. a', '2. b', '3. c', '4. '], 1, false)).toEqual([])
  })

  it('respects indentation levels', () => {
    const edits = computeOrderedRenumber(['1. a', '  2. x', '  3. y'], 2, true)
    expect(edits).toEqual([
      { line: 2, text: '  1. x' },
      { line: 3, text: '  2. y' },
    ])
  })

  it('preserves the original delimiter and spacing', () => {
    // 删除原第 2 项（"2) b"）后，剩余 "1) a" / "3)  b"，第 2 行补位为 2) 且保留两个空格
    const edits = computeOrderedRenumber(['1) a', '3)  b'], 2, true)
    expect(edits).toEqual([{ line: 2, text: '2)  b' }])
  })

  it('returns nothing when the changed line is not an ordered item', () => {
    expect(computeOrderedRenumber(['1. a', '- b', '3. c'], 2, false)).toEqual([])
  })
})

describe('computeRunRenumber', () => {
  it('re-numbers the whole run from its first item', () => {
    const edits = computeRunRenumber(['1. a', '5. b', '9. c'], 2)
    expect(edits).toEqual([
      { line: 2, text: '2. b' },
      { line: 3, text: '3. c' },
    ])
  })

  it('returns nothing for a non-list line', () => {
    expect(computeRunRenumber(['plain'], 1)).toEqual([])
  })
})
