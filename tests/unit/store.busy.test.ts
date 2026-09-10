import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBusyStore } from '../../src/stores/busy'

beforeEach(() => setActivePinia(createPinia()))

describe('busy store', () => {
  it('begin/end toggles isBusy with nesting', () => {
    const b = useBusyStore()
    expect(b.isBusy).toBe(false)
    b.begin('a')
    expect(b.isBusy).toBe(true)
    b.begin('b')
    b.end()
    expect(b.isBusy).toBe(true)
    b.end()
    expect(b.isBusy).toBe(false)
  })

  it('run wraps async op and clears busy', async () => {
    const b = useBusyStore()
    const result = await b.run('x', async () => 42)
    expect(result).toBe(42)
    expect(b.isBusy).toBe(false)
  })

  it('run clears busy even on error', async () => {
    const b = useBusyStore()
    await expect(b.run('x', async () => {
      throw new Error('boom')
    })).rejects.toThrow('boom')
    expect(b.isBusy).toBe(false)
  })
})
