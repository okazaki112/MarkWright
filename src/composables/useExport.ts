/**
 * 导出 PDF / HTML
 * - HTML 导出：将当前 markdown 渲染后的 HTML + 内联样式写入文件
 * - PDF 导出：构造带打印样式的 HTML，调用浏览器 print 走系统 PDF
 */
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { renderMarkdown } from './useMarkdownRenderer'
import { useDocumentStore } from '../stores/document'
import { useToastStore } from '../stores/toast'

/**
 * 剥离标题锚点链接（markdown-it-anchor 注入的 `<a class="header-anchor">#</a>`）。
 * 应用内预览靠 preview.css 悬停显示，导出场景没有这些规则，
 * 不剥离的话每个标题前都会渲染出一个多余的「#」。
 */
export function stripHeaderAnchors(html: string): string {
  return html.replace(/<a[^>]*class="[^"]*header-anchor[^"]*"[^>]*>[\s\S]*?<\/a>/g, '')
}

/** 导出完整 HTML 文件（带样式） */
export async function exportHtml(): Promise<boolean> {
  const doc = useDocumentStore()
  const target = await saveDialog({
    title: '导出 HTML',
    defaultPath: (doc.activeTab?.name || 'untitled').replace(/\.md$/, '.html'),
    filters: [{ name: 'HTML', extensions: ['html', 'htm'] }],
  })
  if (!target) return false
  const html = buildStandaloneHtml(doc.activeTab?.content ?? '', doc.activeTab?.name ?? 'document')
  try {
    await writeTextFile(target, html)
    return true
  } catch (e) {
    console.error('exportHtml failed', e)
    return false
  }
}

/** 导出 PDF：通过 window.print 触发系统打印对话框 */
export function exportPdf(): void {
  // 在新窗口中打开打印页（含样式）
  const doc = useDocumentStore()
  const toasts = useToastStore()
  const html = buildStandaloneHtml(doc.activeTab?.content ?? '', doc.activeTab?.name ?? 'document')
  const w = window.open('', '_blank')
  if (!w) {
    toasts.warn('无法打开打印窗口', '请允许浏览器弹窗后重试')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  // 等待资源加载
  w.addEventListener('load', () => {
    setTimeout(() => w.print(), 300)
  })
}

/** 复制 HTML 片段到剪贴板（富文本） */
export async function copyHtmlToClipboard(): Promise<boolean> {
  const doc = useDocumentStore()
  const html = stripHeaderAnchors(renderMarkdown(doc.activeTab?.content ?? ''))
  try {
    const blobHtml = new Blob([html], { type: 'text/html' })
    const blobText = new Blob([doc.activeTab?.content ?? ''], { type: 'text/plain' })
    const item = new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })
    await navigator.clipboard.write([item])
    return true
  } catch (e) {
    console.error('copyHtml failed', e)
    return false
  }
}

/** 预览区样式（HTML 导出与 PNG 导出共用）。
 *  同时作用于 body 与 .mk-page，便于 PNG 以片段方式渲染。 */
export const PREVIEW_CSS = `
  body, .mk-page {
    font-family: var(--font-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI',
      'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif);
    font-size: 16px;
    line-height: 1.75;
    color: var(--fg-0, #1f2328);
    background: var(--bg-0, #ffffff);
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 60px 100px;
  }
  h1, h2, h3, h4, h5, h6 { font-weight: 600; line-height: 1.3; margin: 1.4em 0 0.5em; color: var(--md-heading, #1f2328); }
  h1 { font-size: 2em; border-bottom: 1px solid var(--md-hr, #d0d7de); padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid var(--md-hr, #d0d7de); padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  a { color: var(--md-link, #0969da); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code {
    font-family: var(--font-mono, 'JetBrains Mono', 'SF Mono', Consolas, monospace);
    font-size: 0.9em;
    background: var(--md-code-bg, #f6f8fa);
    color: var(--md-code-inline, #cf222e);
    padding: 0.15em 0.4em;
    border-radius: 4px;
  }
  pre {
    background: var(--md-code-bg, #f6f8fa);
    border: 1px solid var(--border-0, #d0d7de);
    border-radius: 6px;
    padding: 14px 16px;
    overflow: auto;
    line-height: 1.55;
  }
  pre code { background: transparent; padding: 0; color: var(--fg-0, #1f2328); }
  blockquote {
    margin: 0.8em 0; padding: 0.2em 1em;
    color: var(--md-quote-fg, #424a53); border-left: 4px solid var(--md-quote-border, #d0d7de); background: var(--bg-1, #f6f8fa);
  }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid var(--md-table-border, #d0d7de); padding: 6px 12px; text-align: left; }
  th { background: var(--bg-1, #f6f8fa); font-weight: 600; }
  hr { border: 0; border-top: 1px solid var(--md-hr, #d0d7de); margin: 1.5em 0; }
  img { max-width: 100%; height: auto; }
  .task-list-item { list-style: none; }
  input[type='checkbox'] { margin-right: 6px; vertical-align: middle; accent-color: var(--accent, #0969da); }
  kbd {
    display: inline-block;
    padding: 1px 6px;
    font-family: var(--font-mono, Consolas, monospace);
    font-size: 0.85em;
    color: var(--fg-1, #424a53);
    background: var(--bg-1, #f6f8fa);
    border: 1px solid var(--border-0, #d0d7de);
    border-bottom-width: 2px;
    border-radius: 4px;
  }
  @media print {
    body, .mk-page { max-width: none; padding: 0; }
    h1, h2 { page-break-after: avoid; }
    pre, blockquote, table { page-break-inside: avoid; }
  }
`

/** 构造独立 HTML（含基础样式） */
function buildStandaloneHtml(markdown: string, title: string): string {
  const body = stripHeaderAnchors(renderMarkdown(markdown))
  const safeTitle = title.replace(/[<>]/g, '')
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${safeTitle}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${PREVIEW_CSS}</style>
</head>
<body>
${body}
</body>
</html>`
}
