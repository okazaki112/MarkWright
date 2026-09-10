import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCommands, shortcutToEvent, matchShortcut } from '../../src/composables/useCommands'
import { useCommandStore } from '../../src/stores/commands'
import { withSetup } from '../helpers/withSetup'

beforeEach(() => setActivePinia(createPinia()))

describe('shortcut matching', () => {
  it('parses a shortcut into its parts', () => {
    expect(shortcutToEvent('Ctrl+Shift+S')).toEqual({ ctrl: true, shift: true, alt: false, key: 's' })
    expect(shortcutToEvent('Alt+G')).toEqual({ ctrl: false, shift: false, alt: true, key: 'g' })
    expect(shortcutToEvent('Cmd+B')).toEqual({ ctrl: true, shift: false, alt: false, key: 'b' })
  })

  it('matches a keyboard event to its shortcut', () => {
    const e = new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, key: 's' })
    expect(matchShortcut(e, 'Ctrl+Shift+S')).toBe(true)
    const e2 = new KeyboardEvent('keydown', { ctrlKey: true, key: 's' })
    expect(matchShortcut(e2, 'Ctrl+Shift+S')).toBe(false)
  })
})

describe('command registry', () => {
  it('registers the full command list without duplicate shortcuts', () => {
    const { app } = withSetup(() => useCommands())
    const cmds = useCommandStore()
    expect(cmds.commands.length).toBeGreaterThan(20)
    const seen = new Map<string, string>()
    for (const c of cmds.commands) {
      if (c.shortcut) {
        const dup = seen.get(c.shortcut)
        expect(dup, `duplicate shortcut ${c.shortcut}`).toBeUndefined()
        seen.set(c.shortcut, c.id)
      }
    }
    app.unmount()
  })

  it('exposes expected commands', () => {
    const { app } = withSetup(() => useCommands())
    const cmds = useCommandStore()
    const ids = cmds.commands.map((c) => c.id)
    expect(ids).toContain('file.save')
    expect(ids).toContain('export.docx')
    expect(ids).toContain('theme.next')
    // 命令面板与番茄钟快捷键不再冲突（各自独立）
    const palette = cmds.commands.find((c) => c.id === 'global.palette')
    const pomodoro = cmds.commands.find((c) => c.id === 'focus.pomodoro')
    expect(palette?.shortcut).not.toBe(pomodoro?.shortcut)
    app.unmount()
  })
})
