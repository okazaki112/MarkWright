import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useToastStore } from '../../src/stores/toast'

beforeEach(() => setActivePinia(createPinia()))

describe('toast store', () => {
  it('pushes a toast with id and default duration', () => {
    const t = useToastStore()
    const id = t.push({ kind: 'info', text: 'hi' })
    expect(t.items).toHaveLength(1)
    expect(t.items[0].id).toBe(id)
    expect(t.items[0].duration).toBe(4000)
  })

  it('convenience methods set kind and duration', () => {
    const t = useToastStore()
    t.info('i')
    t.success('s')
    t.warn('w')
    t.error('e')
    expect(t.items.map((i) => i.kind)).toEqual(['info', 'success', 'warning', 'error'])
    expect(t.items[3].duration).toBe(6000)
  })

  it('dismiss removes by id', () => {
    const t = useToastStore()
    const id = t.push({ kind: 'info', text: 'x' })
    t.dismiss(id)
    expect(t.items).toHaveLength(0)
  })

  it('clear empties all', () => {
    const t = useToastStore()
    t.info('a')
    t.info('b')
    t.clear()
    expect(t.items).toHaveLength(0)
  })

  it('auto-dismisses after duration', () => {
    vi.useFakeTimers()
    const t = useToastStore()
    t.push({ kind: 'info', text: 'x', duration: 1000 })
    expect(t.items).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(t.items).toHaveLength(0)
    vi.useRealTimers()
  })
})
