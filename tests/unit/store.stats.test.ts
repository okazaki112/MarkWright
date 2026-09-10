import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useDocumentStore } from '../../src/stores/document'
import { useStatsStore, countWords } from '../../src/stores/stats'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('stats store', () => {
  it('countWords counts CJK + ascii tokens', () => {
    // '你好' = 2 CJK chars, 'world' + 'foo' = 2 ascii tokens
    expect(countWords('你好 world foo')).toBe(4)
    expect(countWords('')).toBe(0)
  })

  it('trackChange accumulates and flushes a word event', () => {
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const doc = useDocumentStore()
    doc.setContent('hello world') // 2 ascii
    const stats = useStatsStore()
    stats.startTracking() // lastWords = 2
    doc.setContent('hello world 你好') // 2 ascii + 2 cjk = 4
    stats.trackChange()
    stats.flushTracking()
    expect(tauri.invoke).toHaveBeenCalledWith(
      'record_word_event',
      expect.objectContaining({
        event: expect.objectContaining({ delta: 2, total: 4 }),
      }),
    )
  })

  it('recordWordEvent ignores non-positive delta', async () => {
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const stats = useStatsStore()
    await stats.recordWordEvent(0, 10, 'x')
    expect(tauri.invoke).not.toHaveBeenCalled()
  })

  it('init reads goals from settings', async () => {
    const tauri = getTauri()
    tauri.invoke.mockImplementation(async (cmd: string, args: any) => {
      if (cmd === 'init_db_cmd') return undefined
      if (cmd === 'get_setting') {
        if (args.key === 'dailyGoal') return '1234'
        if (args.key === 'pomodoroGoal') return '7'
        return null
      }
      if (cmd === 'get_daily_stats') return []
      if (cmd === 'get_summary') return { today: {}, week: {}, total: {} }
      return undefined
    })
    const stats = useStatsStore()
    await stats.init()
    expect(stats.dailyGoal).toBe(1234)
    expect(stats.pomodoroGoal).toBe(7)
    expect(stats.initialized).toBe(true)
  })
})
