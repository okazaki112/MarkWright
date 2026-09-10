/**
 * markdown-it 渲染器
 * - 任务列表、标题锚点
 * - highlight.js 代码高亮
 * - 代码块语言识别：mermaid / latex 单独标记为占位
 * - [[wikilink]] 渲染为内部可点击链接
 * - #tag 渲染为内联标签
 */
import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import anchor from 'markdown-it-anchor'
import hljs from 'highlight.js/lib/common'

const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(code: string, lang: string): string {
    if (lang === 'mermaid') {
      return `<pre class="mermaid-source">${md.utils.escapeHtml(code)}</pre>`
    }
    if (lang === 'latex' || lang === 'math') {
      return `<pre class="latex-source">${md.utils.escapeHtml(code)}</pre>`
    }
    if (lang === 'chart' || lang === 'chartjs') {
      // 图表：JSON 配置原样保留到 .chart-source
      return `<pre class="chart-source">${md.utils.escapeHtml(code)}</pre>`
    }
    if (lang === 'kanban') {
      return `<pre class="kanban-source">${md.utils.escapeHtml(code)}</pre>`
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        const out = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
        return `<pre><code class="hljs language-${lang}">${out}</code></pre>`
      } catch {
        /* 落到默认 */
      }
    }
    return `<pre><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`
  },
})

md.use(taskLists, { enabled: true, label: true, labelAfter: true })
md.use(anchor, {
  permalink: anchor.permalink.linkInsideHeader({
    symbol: '#',
    placement: 'before',
    ariaHidden: true,
  }),
  slugify: (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, ''),
})

// 链接渲染钩子：统一处理 锚点 / 内部 wikilink / 外部
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }
md.renderer.rules.link_open = function (tokens, idx, options, env, self): string {
  const token = tokens[idx]
  const href = token.attrGet('href') || ''
  if (href.startsWith('#') && !/^https?:\/\//i.test(href)) {
    token.attrJoin('class', 'header-anchor')
  } else if (href.startsWith('wiki://')) {
    token.attrJoin('class', 'wikilink')
    token.attrSet('data-target', href.slice('wiki://'.length))
  } else if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return defaultLinkOpen(tokens, idx, options, env, self)
}

/* wikilink 预处理：[[文件名]] / [[文件名|别名]] → [别名](wiki://文件名) */
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
const baseRender = md.render.bind(md)
md.render = function (src: string, env?: any): string {
  const preprocessed = src.replace(WIKILINK_RE, (_m, target, label) => {
    const t = String(target).trim()
    const lbl = label ? String(label) : t
    return `[${lbl}](wiki://${t})`
  })
  return baseRender(preprocessed, env)
}

/* 标签：#tag 文字包成 <span class="tag-inline"> */
const TAG_RE = /(^|[\s,，.。!！?？])#([\p{L}\p{N}_-]+)/gu
const baseText =
  md.renderer.rules.text ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }
md.renderer.rules.text = function (tokens, idx, options, env, self): string {
  const out = baseText(tokens, idx, options, env, self)
  return out.replace(TAG_RE, '$1<span class="tag-inline">#$2</span>')
}

/* 图片：本地图延迟到预览端异步读取为 data URL（webview 无文件系统访问），
   网络/资源图（http(s):/data:/asset:/blob:）直接保留 src */
const REMOTE_RE = /^(https?:|data:|asset:|blob:)/i
md.renderer.rules.image = function (tokens, idx, _options, _env, _self): string {
  const token = tokens[idx]
  const src = token.attrGet('src') || ''
  const alt = token.content || ''
  const title = token.attrGet('title')
  const attrs: string[] = []
  if (alt) attrs.push(`alt="${md.utils.escapeHtml(alt)}"`)
  if (title) attrs.push(`title="${md.utils.escapeHtml(title)}"`)
  if (REMOTE_RE.test(src)) {
    attrs.unshift(`src="${md.utils.escapeHtml(src)}"`)
  } else {
    // 本地图：src 留空，由预览端填充 data URL
    attrs.unshift(`data-local-src="${md.utils.escapeHtml(src)}"`)
  }
  // 不使用 loading="lazy"：WebView2 会延迟懒加载图片的 load 事件
  // （控制台 [Intervention] Images loaded lazily... Load events are deferred），
  // 导致占位被打上后无法及时撤销，图片一直显示「图片无法加载」
  return `<img ${attrs.join(' ')}>`
}

export function renderMarkdown(source: string): string {
  return md.render(source || '')
}
