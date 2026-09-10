/**
 * 将 HTML 片段渲染为 PNG（基于 SVG <foreignObject> + Canvas）。
 *
 * 关键点：foreignObject 里的 <img> 会被 Chromium 实际加载，
 * 跨源图片一旦加载，Canvas 即被标记为 tainted，toDataURL 抛 SecurityError。
 * 因此导出前必须把所有图片内联为 base64 data URL；无法内联的图片直接移除。
 */

export interface HtmlToPngOptions {
  /** 文档正文 HTML（由 markdown 渲染器产出） */
  html: string
  /** 页面 CSS（与 HTML 导出共用 PREVIEW_CSS） */
  css: string
  /** 画布宽度（px），默认 820 */
  width?: number
  /** 背景色，默认白色 */
  background?: string
  /** 设备像素比，越高越清晰，默认 2 */
  scale?: number
}

export interface HtmlToPngResult {
  dataUrl: string | null
  /** 失败原因（用于界面提示），成功时为空 */
  reason?: string
}

/** 浏览器画布单边 / 面积上限（Chromium），超限会静默失败 */
const MAX_DIM = 16384
const MAX_AREA = 16384 * 16384

/** 图片内联缓存：同一文档重复导出时避免重复 fetch */
const inlineCache = new Map<string, string>()

/** 读取 blob 为 dataURL */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('read blob failed'))
    reader.readAsDataURL(blob)
  })
}

/** 把 host 内所有 <img> 内联为 data URL；失败则移除（避免画布被污染） */
async function inlineImages(host: HTMLElement): Promise<number> {
  const imgs = Array.from(host.querySelectorAll('img'))
  let inlined = 0
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src')
      if (!src) return
      if (src.startsWith('data:')) {
        inlined++
        return
      }
      const cached = inlineCache.get(src)
      if (cached) {
        img.setAttribute('src', cached)
        img.removeAttribute('srcset')
        inlined++
        return
      }
      try {
        const res = await fetch(src)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const dataUrl = await blobToDataUrl(await res.blob())
        inlineCache.set(src, dataUrl)
        img.setAttribute('src', dataUrl)
        img.removeAttribute('srcset')
        inlined++
      } catch {
        // 内联失败（跨域无 CORS / 本地文件不可读）→ 移除图片占位，保证导出成功
        const alt = img.getAttribute('alt')
        const placeholder = document.createElement('span')
        placeholder.textContent = alt ? `［图片：${alt}］` : '［图片］'
        placeholder.setAttribute('style', 'color:#999;font-size:0.9em;')
        img.replaceWith(placeholder)
      }
    })
  )
  return inlined
}

/**
 * 序列化后再兜底消毒：清空所有非 data:/# 的外部引用。
 * PNG 是位图，<a href> 等链接本就无意义，清空不影响外观，
 但可确保最终 SVG 不含任何会被浏览器加载的跨源资源（杜绝画布污染）。
 * 返回消毒后的字符串与移除数量。
 */
function sanitizeForRaster(xhtml: string): { out: string; removed: number } {
  let removed = 0
  const isSafe = (v: string) => v.startsWith('data:') || v.startsWith('#') || v === ''
  let out = xhtml
  // 属性引用：src / href / xlink:href / poster / data-src（含单双引号）
  out = out.replace(
    /(\s(?:src|href|xlink:href|poster|data-src)\s*=\s*)(["'])([^"']*)\2/gi,
    (_m, pre, _q, val) => {
      if (isSafe(val)) return _m
      removed++
      return `${pre}""`
    }
  )
  // CSS url() 引用（style 属性 / <style> 内容）
  out = out.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/gi, (m, _q, val) => {
    if (isSafe(val)) return m
    removed++
    return 'url()'
  })
  // srcset 一律移除（换行/逗号分隔，直接删属性）
  out = out.replace(/\ssrcset\s*=\s*(["'][^"']*["'])/gi, () => {
    removed++
    return ''
  })
  return { out, removed }
}

/** SVG 源码转 data: URL（比 blob: URL 更稳，规避 foreignObject 污染怪癖） */
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * 将 HTML 片段渲染为 PNG 的 dataURL。
 * 失败时返回 { dataUrl: null, reason }，reason 可直接展示给用户。
 */
export async function htmlToPng(opts: HtmlToPngOptions): Promise<HtmlToPngResult> {
  const { html, css, width = 820, background = '#ffffff', scale = 2 } = opts

  return new Promise((resolve) => {
    void (async () => {
      try {
        // 1) 离屏测量内容高度
        const measure = document.createElement('div')
        measure.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;background:${background};`
        measure.innerHTML = `<style>${css}</style><div class="mk-page">${html}</div>`
        document.body.appendChild(measure)
        const h = Math.max(measure.scrollHeight, 1)
        measure.remove()

        // 2) 用真实 DOM + XMLSerializer 产出合法 XHTML。
        //    不能直接字符串拼接：&nbsp; 等命名实体、<br> 等未闭合标签会让 SVG 不是合法 XML。
        const holder = document.createElement('div')
        holder.innerHTML = `<style>${css}</style><div class="mk-page">${html}</div>`

        // 3) 内联所有图片为 data URL —— 否则画布会被跨源图片污染，toDataURL 直接失败
        await inlineImages(holder)

        const { out: xhtml, removed } = sanitizeForRaster(
          new XMLSerializer().serializeToString(holder)
        )
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}">` +
          `<foreignObject x="0" y="0" width="${width}" height="${h}">` +
          xhtml +
          `</foreignObject></svg>`

        // 4) 画布尺寸保护：内容很长时按上限压低 scale，避免超限后导出空白
        let s = scale
        s = Math.min(s, MAX_DIM / width, MAX_DIM / h, Math.sqrt(MAX_AREA / (width * h)))
        if (!(s > 0)) {
          resolve({ dataUrl: null, reason: '文档过长，超出浏览器图片渲染上限' })
          return
        }

        // 5) SVG 画到 Canvas 再导出 PNG（data: URL 加载，规避 blob 污染问题）
        const img = new Image()

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(width * s)
            canvas.height = Math.round(h * s)
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              resolve({ dataUrl: null, reason: '无法创建 2D 画布上下文' })
              return
            }
            ctx.scale(s, s)
            ctx.drawImage(img, 0, 0)
            const dataUrl = canvas.toDataURL('image/png')
            if (!dataUrl || dataUrl === 'data:,') {
              resolve({ dataUrl: null, reason: '画布导出为空，请缩短文档后重试' })
              return
            }
            resolve({ dataUrl })
          } catch (e) {
            console.error('htmlToPng toDataURL failed', e)
            const msg = String(e)
            const reason = /SecurityError|Tainted/i.test(msg)
              ? `画布仍被安全策略拦截（已自动移除 ${removed} 处外部引用，请反馈该文档内容）`
              : `画布导出失败：${msg}`
            resolve({ dataUrl: null, reason })
          }
        }
        img.onerror = () => {
          console.error('htmlToPng: SVG 加载失败（内容可能不是合法 XML）')
          resolve({ dataUrl: null, reason: '文档内容无法转换为图片（包含不支持的结构）' })
        }
        img.src = svgToDataUrl(svg)
      } catch (e) {
        console.error('htmlToPng failed', e)
        resolve({ dataUrl: null, reason: `图片渲染初始化失败：${String(e)}` })
      }
    })()
  })
}
