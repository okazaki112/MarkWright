import { describe, it, expect, afterEach } from 'vitest'
import { EditorView } from '@codemirror/view'
import { slashMenu } from '../../src/composables/useSlashMenu'

function mount(doc: string) {
  const view = new EditorView({
    doc,
    selection: { anchor: doc.length },
    extensions: [slashMenu()],
    parent: document.body,
  })
  return view
}

function type(view: EditorView, text: string) {
  const pos = view.state.selection.main.head
  view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + text.length } })
}

function menuItems(): HTMLElement[] {
  const menu = document.querySelector('.mw-slash-menu')
  return menu ? Array.from(menu.querySelectorAll('.mw-slash-item')) : []
}

function activeIndex(): number {
  return menuItems().findIndex((el) => el.classList.contains('active'))
}

function pressKey(view: EditorView, key: string) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  view.contentDOM.dispatchEvent(ev)
}

function clickItem(view: EditorView, index: number) {
  menuItems()[index].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
}

afterEach(() => {
  document.querySelectorAll('.mw-slash-menu').forEach((e) => e.remove())
})

describe('slash menu', () => {
  it('行首输入 / 弹出菜单', () => {
    const view = mount('')
    type(view, '/')
    expect(menuItems().length).toBeGreaterThan(0)
    view.destroy()
  })

  it('空白后输入 / 弹出菜单', () => {
    const view = mount('hello ')
    type(view, '/')
    expect(menuItems().length).toBeGreaterThan(0)
    view.destroy()
  })

  it('中文行内（/ 前为中文）也触发', () => {
    const view = mount('写一段')
    type(view, '/')
    expect(menuItems().length).toBeGreaterThan(0)
    view.destroy()
  })

  it('英文单词中间 / 不触发', () => {
    const view = mount('abc')
    type(view, '/')
    expect(menuItems().length).toBe(0)
    view.destroy()
  })

  it('输入查询词后过滤', () => {
    const view = mount('')
    type(view, '/粗')
    const items = menuItems()
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].textContent).toContain('粗体')
    view.destroy()
  })

  it('ArrowDown 高亮下移', () => {
    const view = mount('')
    type(view, '/')
    expect(activeIndex()).toBe(0)
    pressKey(view, 'ArrowDown')
    expect(activeIndex()).toBe(1)
    view.destroy()
  })

  it('ArrowUp 高亮上移（环绕）', () => {
    const view = mount('')
    type(view, '/')
    pressKey(view, 'ArrowUp')
    expect(activeIndex()).toBe(menuItems().length - 1)
    view.destroy()
  })

  it('Enter 插入选中项', () => {
    const view = mount('')
    type(view, '/')
    pressKey(view, 'Enter')
    expect(view.state.doc.toString()).toContain('# ')
    view.destroy()
  })

  it('鼠标点击插入', () => {
    const view = mount('')
    type(view, '/')
    clickItem(view, 0)
    expect(view.state.doc.toString()).toContain('# ')
    view.destroy()
  })
})
