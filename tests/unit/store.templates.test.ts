import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTemplatesStore } from '../../src/stores/templates'

beforeEach(() => setActivePinia(createPinia()))

describe('templates store', () => {
  it('ships four builtin templates', () => {
    const t = useTemplatesStore()
    expect(t.templates.filter((x) => x.builtIn).length).toBe(4)
  })

  it('adds a custom template', () => {
    const t = useTemplatesStore()
    const before = t.templates.length
    t.add({ name: '自定义', icon: 'x', body: '# hi' })
    expect(t.templates.length).toBe(before + 1)
    const added = t.templates[t.templates.length - 1]
    expect(added.builtIn).toBeFalsy()
    expect(added.id).toBeTruthy()
  })

  it('cannot remove a builtin template', () => {
    const t = useTemplatesStore()
    const builtin = t.templates.find((x) => x.builtIn)!
    const before = t.templates.length
    t.remove(builtin.id)
    expect(t.templates.length).toBe(before)
  })

  it('removes a custom template', () => {
    const t = useTemplatesStore()
    t.add({ name: 'c', icon: 'x', body: 'b' })
    const id = t.templates[t.templates.length - 1].id
    t.remove(id)
    expect(t.templates.find((x) => x.id === id)).toBeUndefined()
  })
})
