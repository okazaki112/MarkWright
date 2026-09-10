/**
 * 异步渲染器 - 扩展支持：Mermaid / Chart.js / KaTeX / Kanban
 *
 * v0.4.8 优化：
 *  1. 惰性加载：文档里没有对应语法时，绝不 import 对应的重型库
 *     （mermaid ≈ 1MB、chart.js ≈ 200KB、katex ≈ 280KB 全部走独立 chunk）
 *  2. 视口内渲染：mermaid / chart 块用 IntersectionObserver 延迟到进入
 *     视口（含 300px 预加载边距）才渲染，长文档首屏不再卡顿
 *  3. 结果缓存：相同源码的 mermaid 图只渲染一次
 *  4. 生命周期：dispose() 统一释放 observer / Chart 实例 / Kanban 子应用
 */
import { useUIStore } from '../stores/ui'

let mermaidModule: any = null
let mermaidThemeKey = ''
let mermaidIdCounter = 0
let chartIdCounter = 0

/** 源码 → 已渲染 SVG，避免重复渲染 */
const mermaidCache = new Map<string, string>()
const MAX_CACHE = 40

/** 待可见时执行的渲染任务 */
const pending = new Map<Element, () => void>()
let io: IntersectionObserver | null = null

let charts: { destroy: () => void }[] = []
let kanbanDisposers: (() => void)[] = []

function ensureObserver(): IntersectionObserver {
  if (io) return io
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const fn = pending.get(e.target)
        if (!fn) continue
        pending.delete(e.target)
        io?.unobserve(e.target)
        fn()
      }
    },
    { rootMargin: '300px 0px' },
  )
  return io
}

/** 元素进入视口后才执行 fn */
function whenVisible(el: Element, fn: () => void) {
  pending.set(el, fn)
  ensureObserver().observe(el)
}

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = (await import('mermaid')).default
  }
  const isLight = document.documentElement.getAttribute('data-theme') === 'light'
  const key = isLight ? 'light' : 'dark'
  if (mermaidThemeKey !== key) {
    mermaidModule.initialize({
      startOnLoad: false,
      theme: isLight ? 'default' : 'dark',
      // 用 strict 而非 loose：禁止标签里的 HTML/点击回调，避免注入面
      securityLevel: 'strict',
      fontFamily: 'inherit',
    })
    mermaidThemeKey = key
  }
  return mermaidModule
}

function cacheSet(k: string, v: string) {
  if (mermaidCache.size >= MAX_CACHE) {
    // 简单 FIFO：删除最早的一条
    const first = mermaidCache.keys().next().value
    if (first !== undefined) mermaidCache.delete(first)
  }
  mermaidCache.set(k, v)
}

async function renderMermaid(target: HTMLElement, code: string) {
  const cached = mermaidCache.get(code)
  if (cached) {
    target.innerHTML = cached
    return
  }
  const id = `mermaid-${++mermaidIdCounter}`
  try {
    const mermaid = await getMermaid()
    const { svg } = await mermaid.render(id, code)
    cacheSet(code, svg)
    target.innerHTML = svg
  } catch (e) {
    target.innerHTML = `<pre class="mermaid-error">⚠️ Mermaid 渲染失败：${escapeText((e as Error).message)}</pre>`
  }
}

export function escapeText(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

function dispose() {
  if (io) {
    io.disconnect()
    io = null
  }
  pending.clear()
  for (const c of charts) {
    try { c.destroy() } catch { /* ignore */ }
  }
  charts = []
  for (const d of kanbanDisposers) {
    try { d() } catch { /* ignore */ }
  }
  kanbanDisposers = []
}

export function useRenderer() {
  const ui = useUIStore()

  async function processElement(root: HTMLElement) {
    if (!root) return

    /* ---------- Mermaid ---------- */
    if (ui.mermaidEnabled) {
      const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-source'))
      if (blocks.length) {
        for (const block of blocks) {
          const code = block.textContent || ''
          const target = document.createElement('div')
          target.className = 'mermaid-rendered'
          block.replaceWith(target)
          if (!code.trim()) continue
          const cached = mermaidCache.get(code)
          if (cached) {
            target.innerHTML = cached
          } else {
            target.innerHTML = '<div class="mermaid-pending">图表待渲染…</div>'
            whenVisible(target, () => void renderMermaid(target, code))
          }
        }
      }
    }

    /* ---------- Kanban ---------- */
    const kanbanBlocks = Array.from(root.querySelectorAll<HTMLElement>('.kanban-source'))
    if (kanbanBlocks.length) {
      const { renderKanban } = await import('./useKanban')
      for (const block of kanbanBlocks) {
        const code = block.textContent || ''
        const target = document.createElement('div')
        target.className = 'kanban-rendered'
        block.replaceWith(target)
        try {
          const unmount = await renderKanban(target, code, (newText: string) => {
            window.dispatchEvent(
              new CustomEvent('markwright:kanban-change', {
                detail: { original: code, next: newText },
              }),
            )
          })
          if (typeof unmount === 'function') kanbanDisposers.push(unmount)
        } catch (e) {
          target.innerHTML = `<div class="kanban-error">⚠️ Kanban 渲染失败：${escapeText((e as Error).message)}</div>`
        }
      }
    }

    /* ---------- Chart.js ---------- */
    const chartBlocks = Array.from(root.querySelectorAll<HTMLElement>('.chart-source'))
    if (chartBlocks.length) {
      const { Chart, registerables } = await import('chart.js')
      Chart.register(...registerables)
      for (const block of chartBlocks) {
        const code = block.textContent || ''
        let config: any
        try {
          config = JSON.parse(code)
        } catch (e) {
          const err = document.createElement('div')
          err.className = 'chart-error'
          err.textContent = `⚠️ 图表配置 JSON 错误：${(e as Error).message}`
          block.replaceWith(err)
          continue
        }
        const id = `chart-${++chartIdCounter}`
        const wrap = document.createElement('div')
        wrap.className = 'chart-wrap'
        const canvas = document.createElement('canvas')
        canvas.id = id
        wrap.appendChild(canvas)
        block.replaceWith(wrap)
        whenVisible(wrap, () => {
          try {
            const inst = new Chart(canvas, config)
            charts.push(inst)
          } catch (e) {
            wrap.innerHTML = `<div class="chart-error">⚠️ 图表渲染失败：${escapeText((e as Error).message)}</div>`
          }
        })
      }
    }

    /* ---------- KaTeX ---------- */
    if (ui.katexEnabled) {
      const text = root.textContent || ''
      // 没有数学记号就不加载 katex（~280KB）
      if (text.includes('$') || text.includes('\\(') || text.includes('\\[')) {
        const autoRender = (await import('katex/contrib/auto-render')).default
        autoRender(root, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false },
          ],
          throwOnError: false,
        })
      }
    }
  }

  return { processElement, dispose }
}
