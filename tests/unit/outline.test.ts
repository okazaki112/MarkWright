import { describe, it, expect } from 'vitest'
import { parseOutline, slugify } from '../../src/composables/useOutline'

describe('slugify', () => {
  it('lowercases and dashes spaces', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('strips punctuation but keeps CJK', () => {
    expect(slugify('特殊! 标题@#')).toBe('特殊-标题')
  })

  it('collapses and trims dashes', () => {
    expect(slugify('  a  --  b  ')).toBe('a-b')
  })
})

describe('parseOutline', () => {
  it('parses headings with level/text/slug/line', () => {
    const md = '# A\n\ntext\n\n## B\n\n### C'
    const items = parseOutline(md)
    expect(items.map((i) => i.text)).toEqual(['A', 'B', 'C'])
    expect(items.map((i) => i.level)).toEqual([1, 2, 3])
    expect(items[0].line).toBe(1)
    expect(items[1].line).toBe(5)
    expect(items[2].line).toBe(7)
    expect(items[0].slug).toBe('a')
  })

  it('ignores headings inside fenced code blocks', () => {
    const md = '```\n# not a heading\n```\n# Real'
    const items = parseOutline(md)
    expect(items).toHaveLength(1)
    expect(items[0].text).toBe('Real')
  })

  it('strips inline formatting from heading text', () => {
    const items = parseOutline('# **Bold** and `code`')
    expect(items[0].text).toBe('Bold and code')
  })

  it('returns empty array for empty source', () => {
    expect(parseOutline('')).toEqual([])
  })
})
