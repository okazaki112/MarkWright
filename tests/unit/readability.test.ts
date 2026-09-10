import { describe, it, expect } from 'vitest'
import { readingTime, fleschEnglish, fleschChinese } from '../../src/composables/useReadability'

describe('readingTime', () => {
  it('counts CJK characters and ASCII words', () => {
    const r = readingTime('你好世界 hello world')
    expect(r.cjk).toBe(4)
    expect(r.ascii).toBe(2)
    expect(r.words).toBe(6)
  })

  it('always reports at least 1 minute', () => {
    expect(readingTime('hi').minutes).toBeGreaterThanOrEqual(1)
  })

  it('returns sane minimums for empty text', () => {
    const r = readingTime('')
    expect(r.words).toBe(0)
    expect(r.sentences).toBeGreaterThanOrEqual(1)
    expect(r.paragraphs).toBeGreaterThanOrEqual(1)
  })

  it('counts multiple paragraphs', () => {
    const r = readingTime('第一段。\n\n第二段。')
    expect(r.paragraphs).toBe(2)
  })
})

describe('fleschEnglish', () => {
  it('returns a clamped score with a level', () => {
    const r = fleschEnglish('This is a simple sentence. We write code every day.')
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
    expect(typeof r.level).toBe('string')
  })
})

describe('fleschChinese', () => {
  it('returns a clamped score for chinese text', () => {
    const r = fleschChinese('这是一句中文。这是第二句。')
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('returns a level label', () => {
    expect(typeof fleschChinese('短句。').level).toBe('string')
  })
})
