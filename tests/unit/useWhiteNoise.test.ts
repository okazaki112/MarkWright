import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWhiteNoise } from '../../src/composables/useWhiteNoise'
import { withSetup } from '../helpers/withSetup'

beforeEach(() => setActivePinia(createPinia()))

describe('useWhiteNoise', () => {
  it('setVolume clamps to [0,1]', () => {
    const { result, app } = withSetup(() => useWhiteNoise())
    result.setVolume(2)
    expect(result.volume.value).toBe(1)
    result.setVolume(-1)
    expect(result.volume.value).toBe(0)
    result.setVolume(0.5)
    expect(result.volume.value).toBe(0.5)
    app.unmount()
  })

  it('start("none") stops any noise and reports not playing', () => {
    const { result, app } = withSetup(() => useWhiteNoise())
    result.start('none')
    expect(result.current.value).toBe('none')
    expect(result.playing.value).toBe(false)
    app.unmount()
  })
})
