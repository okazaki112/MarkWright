<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { renderMarkdown } from '../composables/useMarkdownRenderer'
import { useRenderer } from '../composables/useRenderer'
import { useDocumentStore } from '../stores/document'
import { useLinksStore } from '../stores/links'
import { useToastStore } from '../stores/toast'
import { dirname } from '@tauri-apps/api/path'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { buildImageCandidates } from '../composables/useLocalImage'
import { useWorkspaceStore } from '../stores/workspace'
import { useVault } from '../composables/useVault'

const doc = useDocumentStore()
const links = useLinksStore()
const toasts = useToastStore()
const ws = useWorkspaceStore()
const vault = useVault()
const html = ref<string>('')
const rendering = ref(false)
const paneRef = ref<HTMLElement | null>(null)
const { processElement, dispose } = useRenderer()
const emit = defineEmits<{ (e: 'scroll'): void }>()

/**
 * v0.4.8：预览渲染节流
 * - 输入时 120ms 合并一次，避免每个按键都全量 markdown-it + 重渲染
 * - 切 tab 立即渲染，不做节流
 * - 源码没变则完全跳过（例如只移动了光标）
 * - 每次重渲染前 dispose 上一轮的 Chart / Kanban / observer，杜绝实例泄漏
 */
const RENDER_DELAY = 120
let timer: number | undefined
let seq = 0
let lastSource: string | null = null
let lastActiveId = doc.activeId

async function renderNow() {
  const source = doc.activeTab?.content ?? ''
  if (source === lastSource) return
  lastSource = source

  const my = ++seq
  rendering.value = true
  html.value = renderMarkdown(source)
  await nextTick()
  // 期间又发生了新渲染：放弃本次后续处理
  if (my !== seq) return
  dispose()
  if (paneRef.value) {
    await processElement(paneRef.value)
    if (my !== seq) return
    await resolveImages(paneRef.value)
  }
  if (my === seq) rendering.value = false
}

/** 图片 data URL 缓存（key 为解析后的绝对路径），避免每次按键重读磁盘 */
const imgCache = new Map<string, string>()
/** 已提示过的失败路径，避免同一张图每次重渲染都弹提示 */
const imgErrNotified = new Set<string>()
function markBroken(img: HTMLImageElement) {
  img.classList.add('img-broken')
}
function markLoaded(img: HTMLImageElement) {
  img.classList.remove('img-broken')
}

/** 给 img 设置 src 并返回是否加载成功（带超时，避免资产协议卡住不返回） */
function tryLoad(img: HTMLImageElement, src: string, timeout = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      clearTimeout(timer)
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onErr)
      resolve(ok)
    }
    const onLoad = () => finish(true)
    const onErr = () => finish(false)
    const timer = window.setTimeout(() => finish(false), timeout)
    img.addEventListener('load', onLoad)
    img.addEventListener('error', onErr)
    img.src = src
  })
}

/**
 * 本地图解析：优先资产协议（webview 流式直读本地文件，不经 IPC、无大小限制），
 * 失败再回退 Rust 命令读成 data URL。返回最终可用的 src，全部失败则抛错。
 */
async function resolveLocalImage(img: HTMLImageElement, full: string): Promise<string> {
  const assetUrl = convertFileSrc(full)
  if (await tryLoad(img, assetUrl)) return assetUrl
  console.warn('[图片] 资产协议加载失败，回退 data URL：', full, assetUrl)
  const dataUrl = await invoke<string>('read_image_data_url', { path: full })
  if (await tryLoad(img, dataUrl)) return dataUrl
  throw new Error(`资产协议与 data URL 均失败（${full}）`)
}

/**
 * 为远程图挂 load/error 监听。
 * error → 显示「图片无法加载」占位；
 * load  → 撤销占位（远程图可能在我们判定时尚未加载完，需要能自愈）。
 */
function watchImg(img: HTMLImageElement) {
  img.addEventListener('load', () => markLoaded(img))
  img.addEventListener('error', () => {
    const s = img.getAttribute('src') || ''
    console.warn(
      '[图片] img 触发 error：src 类型=',
      s.startsWith('data:') ? 'data URL' : s.slice(0, 80),
      ' src 长度=',
      s.length,
    )
    markBroken(img)
  })
}

/** 统一失败处理：控制台 + 悬浮提示 + Toast（同一路径只提示一次，避免每次按键刷屏） */
function failImage(img: HTMLImageElement, key: string, msg: string) {
  console.warn('[图片] 本地图片读取失败：', key, msg)
  img.title = `读取失败：${key} —— ${msg}`
  if (!imgErrNotified.has(key)) {
    imgErrNotified.add(key)
    toasts.error('图片读取失败', `${key}\n${msg}`)
  }
  markBroken(img)
}

/**
 * 解析预览中的图片：
 * - 本地图（data-local-src）：归一化路径 → 生成候选 → Rust 探测存在 → 资产协议 / data URL 读取
 * - 远程图：src 已由渲染器写入，只监听加载结果
 * 仅在 Tauri 运行时解析本地文件；测试/网页预览环境直接跳过，避免调用 Tauri API 崩溃
 */
async function resolveImages(root: HTMLElement) {
  const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
  const basePath = doc.activeTab?.path ?? null
  let docDir: string | null = null
  if (inTauri && basePath) {
    try {
      docDir = await dirname(basePath)
    } catch {
      docDir = null
    }
  }
  const wsRoot = ws.rootPath
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
  for (const img of imgs) {
    const local = img.getAttribute('data-local-src')
    if (!local) {
      watchImg(img)
      // 没有 src 的图 = 本地图尚未解析完成（通常正被上一轮并发的 invoke 处理中）。
      // 注意：无 src 的 <img> 其 complete 恒为 true、naturalWidth 恒为 0，
      // 若在此判定就会把「还没解析完」误判成「加载失败」，曾导致本地图永久显示占位。
      if (!img.getAttribute('src')) continue
      // 远程图：src 已由渲染器写入。补齐「在我们挂监听前就已加载完/已失败」的情况
      if (img.complete) {
        if (img.naturalWidth > 0) markLoaded(img)
        else {
          console.warn('[图片] 远程图加载失败，src=', img.src)
          markBroken(img)
        }
      }
      continue
    }
    img.removeAttribute('data-local-src')
    if (!inTauri) {
      // 浏览器无法按路径读取本地文件，本地图只能在 Tauri 应用内显示
      console.warn('[图片] 非 Tauri 环境（浏览器预览），无法读取本地图片：', local)
      if (!imgErrNotified.has('__not_tauri__')) {
        imgErrNotified.add('__not_tauri__')
        toasts.warn('本地图片无法显示', '当前是浏览器预览，请用 npm run tauri dev 启动应用')
      }
      markBroken(img)
      continue
    }
    const candidates = await buildImageCandidates(local, docDir, wsRoot)
    if (!candidates.length) {
      failImage(img, local, '无法确定图片所在目录（文档未保存且未打开工作区）')
      continue
    }
    // 先用一次轻量 IPC 命中真实文件：避免对不存在的候选逐个发起资产协议请求并等待超时
    let full: string | null
    try {
      full = await invoke<string | null>('first_existing_path', { paths: candidates })
    } catch (err) {
      console.warn('[图片] 存在性探测不可用，回退直接尝试首个候选：', err)
      full = candidates[0]
    }
    if (!full) {
      failImage(img, local, `未找到文件，已尝试：\n${candidates.join('\n')}`)
      continue
    }
    const cached = imgCache.get(full)
    if (cached) {
      img.src = cached
      markLoaded(img)
      continue
    }
    try {
      // 优先资产协议，回退 Rust 直读（均不受 fs 插件 scope 限制）
      const url = await resolveLocalImage(img, full)
      imgCache.set(full, url)
      markLoaded(img)
    } catch (err) {
      failImage(img, full, String(err))
    }
  }
}

function schedule(immediate = false) {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  if (immediate) {
    void renderNow()
    return
  }
  timer = window.setTimeout(() => {
    timer = undefined
    void renderNow()
  }, RENDER_DELAY)
}

watch(
  () => [doc.activeId, doc.activeTab?.content],
  () => {
    const switched = doc.activeId !== lastActiveId
    lastActiveId = doc.activeId
    schedule(switched)
  }
)

onMounted(() => schedule(true))

onBeforeUnmount(() => {
  if (timer) {
    clearTimeout(timer)
    timer = undefined
  }
  dispose()
})

defineExpose({
  getPane: () => paneRef.value,
})

async function onContentClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const a = target.closest('a') as HTMLAnchorElement | null
  if (!a) return
  const wiki = a.getAttribute('data-target')
  if (wiki) {
    e.preventDefault()
    const path = links.resolveWikiLink(wiki)
    if (path) {
      try {
        // 目标可能是加密文档：交给 Vault 自动识别并解密
        const text = await vault.readDocument(path)
        doc.loadFromPath(path, text)
      } catch (err) {
        if (!String(err).includes('已取消')) toasts.error('打开失败', String(err))
      }
    } else {
      toasts.warn('目标文件不存在', `${wiki}.md`)
    }
  }
}
</script>

<template>
  <div
    ref="paneRef"
    class="preview-pane"
    @scroll="emit('scroll')"
    @click="onContentClick"
  >
    <div v-if="rendering" class="render-badge">渲染中…</div>
    <article class="preview-content" v-html="html" />
  </div>
</template>

<style scoped>
.preview-pane {
  height: 100%;
  overflow: auto;
  user-select: text;
}

/* Mermaid 渲染占位 */
:deep(.mermaid-source) {
  display: none;
}
:deep(.mermaid-pending) {
  padding: 12px;
  text-align: center;
  font-size: var(--fz-xs);
  color: var(--fg-3);
  background: var(--bg-1);
  border-radius: var(--radius-md);
}
:deep(.mermaid-rendered) {
  display: flex;
  justify-content: center;
  margin: 1em 0;
  padding: 12px;
  background: var(--bg-1);
  border-radius: var(--radius-md);
}
:deep(.mermaid-rendered svg) {
  max-width: 100%;
  height: auto;
}
:deep(.mermaid-error) {
  background: rgba(248, 81, 73, 0.1);
  border-left: 4px solid var(--danger);
  color: var(--danger);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.9em;
}

/* KaTeX 样式补充 */
:deep(.katex) {
  font-size: 1.1em;
}
:deep(.katex-display) {
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
