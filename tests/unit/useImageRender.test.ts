import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../../src/composables/useMarkdownRenderer'

describe('markdown 图片渲染', () => {
  it('网络图保留 src', () => {
    const html = renderMarkdown('![a](https://example.com/x.png)')
    expect(html).toContain('<img')
    expect(html).toContain('src="https://example.com/x.png"')
    expect(html).not.toContain('data-local-src')
  })

  it('data: 图片保留 src', () => {
    const html = renderMarkdown('![a](data:image/png;base64,iVBORw0KGgo=)')
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="')
    expect(html).not.toContain('data-local-src')
  })

  it('本地相对图改用 data-local-src（预览端异步解析）', () => {
    const html = renderMarkdown('![a](./pic.png)')
    expect(html).toContain('data-local-src="./pic.png"')
    expect(html).not.toContain(' src="')
  })

  it('本地绝对图改用 data-local-src', () => {
    const html = renderMarkdown('![a](C:/a/b.png)')
    expect(html).toContain('data-local-src="C:/a/b.png"')
  })

  it('带标题的图片保留 title', () => {
    const html = renderMarkdown('![a](./p.png "提示")')
    expect(html).toContain('title="提示"')
    expect(html).toContain('data-local-src="./p.png"')
  })
})
