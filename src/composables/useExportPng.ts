/**
 * 导出 PNG：将当前 Markdown 渲染后的文档导出为一张 PNG 图片。
 * 关键：导出走离屏渲染，必须手动注入当前主题的
 *   1) CSS 变量快照（颜色/字体）
 *   2) 内容渲染家族规则（content-themes.css 中匹配 data-content 的规则）
 * 否则导出的只是默认白底样式，与应用内所见不一致。
 */
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { renderMarkdown } from './useMarkdownRenderer'
import { PREVIEW_CSS, stripHeaderAnchors } from './useExport'
import { htmlToPng } from './useHtmlToPng'
import { ALL_THEME_VARS } from '../data/themes'
import { useDocumentStore } from '../stores/document'
import { useToastStore } from '../stores/toast'

/** 导出图片宽度（与预览 max-width 820 对齐） */
const EXPORT_WIDTH = 820

/** 当前主题的 CSS 变量快照（:root{...}），含字体与预览排版令牌 */
function buildThemeVarsCss(): string {
  const cs = getComputedStyle(document.documentElement)
  const names = new Set<string>(ALL_THEME_VARS)
  // 字体 / 排版 / 装饰令牌不随主题 vars 走，单独补齐
  for (const n of [
    '--font-sans', '--font-serif', '--font-display', '--font-mono', '--font-ui',
    '--fz-preview', '--line-h-preview',
    '--radius-sm', '--radius-md', '--radius-lg',
    '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-paper',
    '--accent-soft', '--glow-color',
  ]) {
    names.add(n)
  }
  const parts: string[] = []
  for (const name of names) {
    const v = cs.getPropertyValue(name).trim()
    if (v) parts.push(`${name}:${v}`)
  }
  return `:root{${parts.join(';')}}`
}

/**
 * 从文档样式表中采集与当前主题匹配的内容渲染规则。
 * - data-content 家族规则（content-themes.css）
 * - data-decoration 装饰规则（preview.css 中纸张模式等）
 * 把 `:root[data-xxx='v']` 前缀剥掉（SVG 片段内 :root 即 svg 根，可命中），
 * 并把 `.preview-content` 重写为 `.mk-page`（导出片段的根类名）。
 */
function collectFamilyCss(): string {
  const root = document.documentElement
  const content = root.getAttribute('data-content') || 'modern'
  const theme = root.getAttribute('data-theme') || 'dark'
  const decoration = root.getAttribute('data-decoration') || 'flat'
  const out: string[] = []

  const wanted = (sel: string): boolean => {
    // 代码高亮规则（hljs）任何主题都需要，让家族专属配色在后加载覆盖默认色
    if (sel.includes('.hljs')) return true
    if (!sel.includes('[data-')) return false
    if (sel.includes(`data-content='${content}'`) || sel.includes(`data-content="${content}"`)) {
      if (sel.includes("data-theme='light'") && theme !== 'light') return false
      if (sel.includes("data-theme='dark'") && theme !== 'dark') return false
      return true
    }
    if (sel.includes(`data-decoration='${decoration}'`) || sel.includes(`data-decoration="${decoration}"`)) {
      return true
    }
    return false
  }

  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSMediaRule) {
        walk(rule.cssRules)
        continue
      }
      if (!(rule instanceof CSSStyleRule)) continue
      const sel = rule.selectorText || ''
      if (!wanted(sel)) continue
      const stripped = sel.replace(/^:root(\[[^\]]*\])+\s*/, '')
      const rewritten = stripped.replace(/\.preview-content/g, '.mk-page')
      if (rule.style.cssText) out.push(`${rewritten}{${rule.style.cssText}}`)
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.cssRules) walk(sheet.cssRules)
    } catch {
      /* 跨域样式表跳过 */
    }
  }
  return out.join('\n')
}

/**
 * 二进制写盘：优先走 fs 插件；被权限/scope 拒绝时回退 Rust 直写
 * （保存对话框选的路径由用户决定，不应受 fs scope 限制）。
 */
export async function writeBytesSmart(path: string, bytes: Uint8Array): Promise<void> {
  try {
    await writeFile(path, bytes)
    return
  } catch {
    /* scope 拒绝等情况 → 走 Rust 直写 */
  }
  // 分块转 base64，避免大文件栈溢出
  let b64 = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  await invoke('write_export_file', { path, base64Data: btoa(b64) })
}

/** 导出 PNG 图片；返回是否成功 */
export async function exportPng(): Promise<boolean> {
  const doc = useDocumentStore()
  const toasts = useToastStore()
  const name = doc.activeTab?.name || 'untitled'

  const target = await saveDialog({
    title: '导出 PNG 图片',
    defaultPath: name.replace(/\.md$/, '.png'),
    filters: [{ name: 'PNG 图片', extensions: ['png'] }],
  })
  if (!target) return false

  const body = stripHeaderAnchors(renderMarkdown(doc.activeTab?.content ?? ''))
  // 组装导出样式：基础排版 + 主题变量快照 + 当前内容渲染家族
  const css = [PREVIEW_CSS, buildThemeVarsCss(), collectFamilyCss()].join('\n')
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-0').trim() || '#ffffff'

  const { dataUrl, reason } = await htmlToPng({
    html: body,
    css,
    width: EXPORT_WIDTH,
    background: bg,
    scale: 2,
  })
  if (!dataUrl) {
    toasts.error('导出 PNG 失败', reason ?? '当前环境不支持图片渲染')
    return false
  }

  const base64 = dataUrl.split(',')[1]
  if (!base64) {
    toasts.error('导出 PNG 失败', '图片数据为空')
    return false
  }

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  try {
    await writeBytesSmart(target, bytes)
    return true
  } catch (e) {
    console.error('exportPng write failed', e)
    toasts.error('导出 PNG 失败', `写入文件失败：${String(e)}`)
    return false
  }
}
