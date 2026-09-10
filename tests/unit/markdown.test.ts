import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '../../src/composables/useMarkdownRenderer'

describe('renderMarkdown', () => {
  it('renders a heading with an anchor id', () => {
    const html = renderMarkdown('# Hello World')
    expect(html).toContain('id="hello-world"')
    expect(html).toContain('Hello World')
  })

  it('renders wikilinks without alias', () => {
    const html = renderMarkdown('see [[Note]]')
    expect(html).toContain('class="wikilink"')
    expect(html).toContain('data-target="Note"')
  })

  it('renders wikilinks with alias', () => {
    const html = renderMarkdown('see [[Note|别名]]')
    expect(html).toContain('data-target="Note"')
    expect(html).toContain('别名')
  })

  it('renders inline tags', () => {
    const html = renderMarkdown('a #tag here')
    expect(html).toContain('class="tag-inline"')
    expect(html).toContain('#tag')
  })

  it('marks a mermaid code block', () => {
    const html = renderMarkdown('```mermaid\n graph LR\n```')
    expect(html).toContain('class="mermaid-source"')
  })

  it('marks a chart code block', () => {
    const html = renderMarkdown('```chart\n{}\n```')
    expect(html).toContain('class="chart-source"')
  })

  it('marks a kanban code block', () => {
    const html = renderMarkdown('```kanban\n# 待办\n- [ ] x\n```')
    expect(html).toContain('class="kanban-source"')
  })

  it('highlights known languages', () => {
    const html = renderMarkdown('```js\nconst a = 1\n```')
    expect(html).toContain('language-js')
    expect(html).toContain('hljs')
  })

  it('renders a task list', () => {
    const html = renderMarkdown('- [ ] todo\n- [x] done')
    expect(html).toContain('type="checkbox"')
  })
})
