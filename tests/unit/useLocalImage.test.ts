import { describe, it, expect } from 'vitest'
import {
  normalizeImageSrc,
  isAbsoluteImagePath,
  buildImageCandidates,
} from '../../src/composables/useLocalImage'

describe('normalizeImageSrc', () => {
  it('keeps a plain relative path', () => {
    expect(normalizeImageSrc('./assets/pic.png')).toBe('./assets/pic.png')
  })

  it('decodes markdown-it percent-encoded backslashes (Windows absolute path)', () => {
    // markdown-it 把 C:\Users\me\pic.png 编码成 C:%5CUsers%5Cme%5Cpic.png
    expect(normalizeImageSrc('C:%5CUsers%5Cme%5Cpic.png')).toBe('C:/Users/me/pic.png')
  })

  it('decodes %20 back to a space', () => {
    expect(normalizeImageSrc('./assets/a%20b.png')).toBe('./assets/a b.png')
  })

  it('unwraps markdown <...> and quotes', () => {
    expect(normalizeImageSrc('<./assets/a b.png>')).toBe('./assets/a b.png')
    expect(normalizeImageSrc('"assets/x.png"')).toBe('assets/x.png')
  })

  it('converts file:// URL to a local path', () => {
    expect(normalizeImageSrc('file:///C:/Users/me/pic.png')).toBe('C:/Users/me/pic.png')
  })

  it('keeps a literal % that is not a valid escape', () => {
    expect(normalizeImageSrc('assets/50%.png')).toBe('assets/50%.png')
  })

  it('normalizes backslashes to forward slashes', () => {
    expect(normalizeImageSrc('assets\\sub\\pic.png')).toBe('assets/sub/pic.png')
  })
})

describe('isAbsoluteImagePath', () => {
  it('detects Windows drive, UNC and POSIX paths', () => {
    expect(isAbsoluteImagePath('C:/a/b.png')).toBe(true)
    expect(isAbsoluteImagePath('//server/share/a.png')).toBe(true)
    expect(isAbsoluteImagePath('/abs/a.png')).toBe(true)
  })

  it('rejects relative paths', () => {
    expect(isAbsoluteImagePath('./a.png')).toBe(false)
    expect(isAbsoluteImagePath('assets/a.png')).toBe(false)
  })
})

describe('buildImageCandidates', () => {
  it('returns the absolute path as-is', async () => {
    const out = await buildImageCandidates('C:/pics/a.png', 'C:/notes', 'C:/vault')
    expect(out).toEqual(['C:/pics/a.png'])
  })

  it('resolves a relative path against doc dir then workspace root', async () => {
    const out = await buildImageCandidates('./assets/a.png', '/vault/notes', '/vault')
    expect(out).toEqual(['/vault/notes/assets/a.png', '/vault/assets/a.png'])
  })

  it('dedupes when doc dir equals workspace root', async () => {
    const out = await buildImageCandidates('./assets/a.png', '/vault', '/vault')
    expect(out).toEqual(['/vault/assets/a.png'])
  })

  it('falls back to workspace root when the document is unsaved', async () => {
    const out = await buildImageCandidates('./assets/a.png', null, '/vault')
    expect(out).toEqual(['/vault/assets/a.png'])
  })

  it('returns no candidates without any base dir', async () => {
    expect(await buildImageCandidates('./assets/a.png', null, null)).toEqual([])
    expect(await buildImageCandidates('', '/vault', '/vault')).toEqual([])
  })
})
