import { describe, it, expect } from 'vitest'
import { escapeText } from '../../src/composables/useRenderer'

describe('escapeText', () => {
  it('escapes html special chars', () => {
    expect(escapeText('<b>&"c</b>')).toBe('&lt;b&gt;&amp;&quot;c&lt;/b&gt;')
  })
  it('passes through plain text', () => {
    expect(escapeText('hello world')).toBe('hello world')
  })
})
