import { describe, it, expect, afterEach } from 'vitest'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { orderedListRenumber } from '../../src/composables/useListRenumber'

let view: EditorView | null = null

function makeView(doc: string) {
  view = new EditorView({
    state: EditorState.create({ doc, extensions: [orderedListRenumber()] }),
  })
  return view
}

afterEach(() => {
  view?.destroy()
  view = null
})

describe('orderedListRenumber plugin', () => {
  it('re-numbers the following items after a whole-line deletion', () => {
    const v = makeView('1. a\n2. b\n3. c')
    const l2 = v.state.doc.line(2)
    // 删除第 2 行整行（含换行）
    v.dispatch({ changes: { from: l2.from, to: l2.to + 1, insert: '' } })
    expect(v.state.doc.toString()).toBe('1. a\n2. c')
  })

  it('keeps a hand-edited number and shifts the rest', () => {
    const v = makeView('1. a\n2. b\n3. c')
    const l2 = v.state.doc.line(2)
    v.dispatch({ changes: { from: l2.from, to: l2.from + 1, insert: '5' } })
    expect(v.state.doc.toString()).toBe('1. a\n5. b\n6. c')
  })

  it('leaves sequential lists untouched', () => {
    const v = makeView('1. a\n2. b\n3. c')
    const l1 = v.state.doc.line(1)
    // 在行尾插入字符：不改变序号
    v.dispatch({ changes: { from: l1.to, insert: '!' } })
    expect(v.state.doc.toString()).toBe('1. a!\n2. b\n3. c')
  })

  it('ignores non-list edits', () => {
    const v = makeView('hello\nworld')
    const l1 = v.state.doc.line(1)
    v.dispatch({ changes: { from: l1.to, insert: ' there' } })
    expect(v.state.doc.toString()).toBe('hello there\nworld')
  })

  it('does not rewrite on a whole-document replacement (opening a file)', () => {
    const v = makeView('1. a\n2. b')
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: '1. x\n5. y\n3. z' } })
    expect(v.state.doc.toString()).toBe('1. x\n5. y\n3. z')
  })
})
