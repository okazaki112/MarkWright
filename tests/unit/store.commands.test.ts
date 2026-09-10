import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCommandStore } from '../../src/stores/commands'

beforeEach(() => setActivePinia(createPinia()))

describe('command store', () => {
  it('registers and executes a command', () => {
    const c = useCommandStore()
    let ran = false
    c.register({ id: 'test.run', title: 'Run', group: 'Test', run: () => { ran = true } })
    c.execute('test.run')
    expect(ran).toBe(true)
  })

  it('updates an existing command on re-register', () => {
    const c = useCommandStore()
    c.register({ id: 'x', title: 'A', group: 'g', run: () => {} })
    c.register({ id: 'x', title: 'B', group: 'g', run: () => {} })
    expect(c.commands.filter((cmd) => cmd.id === 'x')).toHaveLength(1)
    expect(c.commands.find((cmd) => cmd.id === 'x')!.title).toBe('B')
  })

  it('does not run a command whose when() returns false', () => {
    const c = useCommandStore()
    let ran = false
    c.register({ id: 'g', title: 'G', group: 'g', when: () => false, run: () => { ran = true } })
    c.execute('g')
    expect(ran).toBe(false)
  })

  it('filters commands by query', () => {
    const c = useCommandStore()
    c.register({ id: 'file.save', title: '保存', group: '文件', run: () => {} })
    c.register({ id: 'edit.copy', title: '复制', group: '编辑', run: () => {} })
    const r = c.filtered('保存')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('file.save')
  })

  it('palette open/close flags', () => {
    const c = useCommandStore()
    c.openPalette()
    expect(c.paletteOpen).toBe(true)
    c.closePalette()
    expect(c.paletteOpen).toBe(false)
  })
})
