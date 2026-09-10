import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePomodoro } from '../../src/composables/usePomodoro'
import { useStatsStore } from '../../src/stores/stats'
import { withSetup } from '../helpers/withSetup'
import { getTauri } from '../setup'

beforeEach(() => setActivePinia(createPinia()))

describe('usePomodoro', () => {
  it('starts in focus phase and sets the full duration', () => {
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const { result, app } = withSetup(() => usePomodoro())
    result.start('focus')
    expect(result.phase.value).toBe('focus')
    expect(result.remaining.value).toBe(25 * 60)
    app.unmount()
  })

  it('counts down one second per tick via the interval', () => {
    vi.useFakeTimers()
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const { result, app } = withSetup(() => usePomodoro())
    result.start('focus')
    vi.advanceTimersByTime(1000)
    expect(result.remaining.value).toBe(25 * 60 - 1)
    app.unmount()
    vi.useRealTimers()
  })

  it('completes a focus session, records a pomodoro and moves to short break', () => {
    vi.useFakeTimers()
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const stats = useStatsStore()
    const spy = vi.spyOn(stats, 'recordPomodoro')
    const { result, app } = withSetup(() => usePomodoro())
    result.start('focus')
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000)
    expect(spy).toHaveBeenCalled()
    expect(result.phase.value).toBe('shortBreak')
    expect(result.completedToday.value).toBe(1)
    app.unmount()
    vi.useRealTimers()
  })

  it('format renders mm:ss', () => {
    const { result, app } = withSetup(() => usePomodoro())
    expect(result.format(65)).toBe('01:05')
    expect(result.format(0)).toBe('00:00')
    app.unmount()
  })

  it('pause keeps remaining; reset returns to idle', () => {
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const { result, app } = withSetup(() => usePomodoro())
    result.start('focus')
    result.pause()
    expect(result.remaining.value).toBe(25 * 60)
    result.reset()
    expect(result.phase.value).toBe('idle')
    expect(result.remaining.value).toBe(0)
    app.unmount()
  })

  it('toggle cycles start → pause → resume', () => {
    vi.useFakeTimers()
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const { result, app } = withSetup(() => usePomodoro())
    result.reset()
    result.toggle()
    expect(result.phase.value).toBe('focus')
    expect(result.running.value).toBe(true)
    result.toggle()
    expect(result.running.value).toBe(false)
    const before = result.remaining.value
    result.toggle()
    expect(result.running.value).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(result.remaining.value).toBe(before - 1)
    result.reset()
    app.unmount()
    vi.useRealTimers()
  })

  it('enters a long break when the streak reaches longBreakEvery', () => {
    vi.useFakeTimers()
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const { result, app } = withSetup(() => usePomodoro())
    result.setLongBreakEvery(1)
    result.start('focus')
    vi.advanceTimersByTime(25 * 60 * 1000)
    expect(result.phase.value).toBe('longBreak')
    expect(result.remaining.value).toBe(15 * 60)
    result.setLongBreakEvery(4)
    result.reset()
    app.unmount()
    vi.useRealTimers()
  })

  it('skip settles the current phase immediately', () => {
    const tauri = getTauri()
    tauri.invoke.mockResolvedValue(undefined)
    const { result, app } = withSetup(() => usePomodoro())
    result.reset()
    result.start('focus')
    result.skip()
    expect(result.phase.value).toBe('shortBreak')
    result.reset()
    app.unmount()
  })
})
