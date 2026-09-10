/**
 * 大纲：从 markdown 源解析所有 ATX 标题 (# ~ ######)
 * - slug 与渲染时 anchor 插件完全一致，确保点击跳转命中
 * - 返回 { level, text, slug, line } 列表
 */
import { computed, ref, watch, onScopeDispose, type Ref } from 'vue'
import { useDocumentStore } from '../stores/document'

export interface OutlineItem {
  level: number    // 1-6
  text: string     // 标题纯文本
  slug: string     // 与 anchor 插件生成的 id 一致
  line: number     // 1-based 行号（用于编辑器联动）
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u4e00-\u9fa5a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function parseOutline(md: string): OutlineItem[] {
  if (!md) return []
  const lines = md.split('\n')
  const items: OutlineItem[] = []
  let inFence = false
  let fenceMarker = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 跳过代码块
    if (/^(\s{0,3})(`{3,}|~{3,})/.test(line)) {
      const m = line.match(/^(\s{0,3})(`{3,}|~{3,})/)
      if (m) {
        const marker = m[2]
        const count = marker.length
        if (!inFence) {
          inFence = true
          fenceMarker = marker[0].repeat(count)
        } else if (marker === fenceMarker || fenceMarker.startsWith(marker)) {
          inFence = false
          fenceMarker = ''
        }
      }
      continue
    }
    if (inFence) continue
    // ATX 标题：# ~ ######
    const m = line.match(/^(\s{0,3})(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (m) {
      const level = m[2].length
      const text = m[3].trim()
      // 去掉行内格式如 ** / * / ` / []() / ![]()
      const clean = text
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      items.push({
        level,
        text: clean,
        slug: slugify(clean),
        line: i + 1,
      })
    }
  }
  return items
}

/** 单条缓存：同一份源码只解析一次（切 tab 来回切换时命中） */
let cacheKey = ''
let cacheVal: OutlineItem[] = []
function parseCached(md: string): OutlineItem[] {
  if (md === cacheKey) return cacheVal
  cacheKey = md
  cacheVal = parseOutline(md)
  return cacheVal
}

export function useOutline(): { items: Ref<OutlineItem[]> } {
  const doc = useDocumentStore()
  const source = ref<string>(doc.activeTab?.content ?? '')

  // 监听活动 Tab 内容变化，节流刷新
  let timer: number | undefined
  let lastId = doc.activeId
  const stopWatch = watch(
    () => [doc.activeId, doc.activeTab?.content],
    () => {
      if (timer) { clearTimeout(timer); timer = undefined }
      // 切 tab：立即重建大纲（无延迟，避免大纲短暂错位）
      const switched = doc.activeId !== lastId
      lastId = doc.activeId
      if (switched) {
        source.value = doc.activeTab?.content ?? ''
        return
      }
      // 编辑输入：200ms 节流，避免每个按键都全量解析
      timer = window.setTimeout(() => {
        timer = undefined
        source.value = doc.activeTab?.content ?? ''
      }, 200)
    }
  )

  // v0.4.8：作用域销毁时清理 watch 与遗留定时器
  onScopeDispose(() => {
    stopWatch()
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
  })

  const items = computed<OutlineItem[]>(() => parseCached(source.value))

  return { items }
}
