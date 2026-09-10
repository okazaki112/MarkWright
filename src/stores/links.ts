/**
 * 链接与标签分析器
 * - 扫描 markdown 源中的 [[wikilink]] 和 #tag
 * - 跨文件聚合：哪些文件被 [[link]] 引用、出现哪些 #tag
 * - 在启动 / 加载文件 / 工作区刷新时重建
 *
 * v0.4.8 优化：
 *  1. 并发读取（默认 8 路），89 个文件从「89 次串行 IPC」降到「8 路流水线」
 *  2. 只扫 .md/.markdown，跳过二进制与大文件（>2MB）
 *  3. 记录 wikilink 出现的行号与上下文，反向链接不再只有空 context
 *  4. WIKILINK_RE / TAG_RE 不再跨调用共享 lastIndex，避免并发下状态串扰
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useWorkspaceStore, type FsNode } from './workspace'
import { readTextFile } from '@tauri-apps/plugin-fs'

export interface Backlink {
  /** 引用了当前文件的其他文件路径 */
  fromPath: string
  fromName: string
  /** 匹配到的原文片段（整行） */
  context: string
  /** 1-based 行号 */
  line: number
}

export interface WikiLink {
  /** 链接目标文件名（不含 .md） */
  target: string
  /** 目标完整路径（解析后） */
  targetPath: string | null
  /** 链接显示文本（若 | 后有别名） */
  label: string
}

export interface TagInfo {
  name: string           // 不含 #
  count: number          // 出现次数
  files: string[]        // 出现在哪些文件
}

const TAG_SRC = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu
const WIKILINK_SRC = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

const MD_EXT = /\.(md|markdown)$/i
const MAX_FILE_CHARS = 2_000_000
const CONCURRENCY = 8

interface OutlinkHit {
  target: string
  line: number
  context: string
}

function flatten(nodes: FsNode[], out: FsNode[] = []): FsNode[] {
  for (const n of nodes) {
    if (!n.isDir) out.push(n)
    if (n.children) flatten(n.children, out)
  }
  return out
}

/** 简易并发池：限制同时在飞的 promise 数量 */
async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return
  const n = Math.min(limit, items.length)
  let cursor = 0
  const workers: Promise<void>[] = []
  for (let w = 0; w < n; w++) {
    workers.push(
      (async () => {
        for (;;) {
          const idx = cursor++
          if (idx >= items.length) return
          await fn(items[idx])
        }
      })(),
    )
  }
  await Promise.all(workers)
}

export const useLinksStore = defineStore('links', () => {
  const ws = useWorkspaceStore()
  const scanning = ref(false)
  const lastScanAt = ref<number>(0)

  /** 文件路径 → 出现的标签（去重）*/
  const fileTags = ref<Map<string, Set<string>>>(new Map())
  /** 文件路径 → 出链 [[target]] 列表（去重）*/
  const fileOutlinks = ref<Map<string, Set<string>>>(new Map())
  /** 文件名（无扩展）→ 路径 */
  const pathByName = ref<Map<string, string>>(new Map())
  /** 标签 → info */
  const tags = ref<Map<string, TagInfo>>(new Map())
  /** 文件名（无扩展）→ 反向链接列表 */
  const backlinks = ref<Map<string, Backlink[]>>(new Map())

  /** 扫描 token：新一轮扫描开始时作废上一轮的结果写入 */
  let scanToken = 0

  async function scanWorkspace() {
    if (!ws.rootPath) return
    const token = ++scanToken
    scanning.value = true

    const files = flatten(ws.tree).filter((f) => MD_EXT.test(f.name))

    const nameToPath = new Map<string, string>()
    for (const f of files) {
      const name = f.name.replace(MD_EXT, '')
      if (!nameToPath.has(name)) nameToPath.set(name, f.path)
    }
    pathByName.value = nameToPath

    const nextFileTags = new Map<string, Set<string>>()
    const nextFileOutlinks = new Map<string, Set<string>>()
    const nextTags = new Map<string, TagInfo>()
    const nextHits = new Map<string, OutlinkHit[]>()

    await mapLimit(files, CONCURRENCY, async (f) => {
      let text: string
      try {
        text = await readTextFile(f.path)
      } catch {
        return
      }
      if (token !== scanToken) return
      // 加密文件（MWV1 密文）不参与标签 / 双链扫描：二进制解出来是乱码，
      // 会污染标签云与反向链接结果。
      if (text.startsWith('MWV1')) return
      if (text.length > MAX_FILE_CHARS) text = text.slice(0, MAX_FILE_CHARS)

      // 每次使用独立正则实例，避免 lastIndex 在多文件间串扰
      const tagRe = new RegExp(TAG_SRC.source, TAG_SRC.flags)
      const wikiRe = new RegExp(WIKILINK_SRC.source, WIKILINK_SRC.flags)

      const tSet = new Set<string>()
      const oSet = new Set<string>()
      const hits: OutlinkHit[] = []
      const lines = text.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        tagRe.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = tagRe.exec(line)) !== null) {
          const tag = m[1]
          tSet.add(tag)
          let info = nextTags.get(tag)
          if (!info) {
            info = { name: tag, count: 0, files: [] }
            nextTags.set(tag, info)
          }
          info.count++
          if (!info.files.includes(f.path)) info.files.push(f.path)
        }

        wikiRe.lastIndex = 0
        while ((m = wikiRe.exec(line)) !== null) {
          const target = m[1].trim()
          if (!target) continue
          oSet.add(target)
          hits.push({ target, line: i + 1, context: line.trim().slice(0, 160) })
        }
      }

      nextFileTags.set(f.path, tSet)
      nextFileOutlinks.set(f.path, oSet)
      if (hits.length) nextHits.set(f.path, hits)
    })

    // 被更新的扫描取代了：丢弃结果，避免竞态覆盖
    if (token !== scanToken) return

    fileTags.value = nextFileTags
    fileOutlinks.value = nextFileOutlinks
    tags.value = nextTags

    rebuildBacklinks(nextHits)
    lastScanAt.value = Date.now()
    scanning.value = false
  }

  /** 反向链接：所有文件出链中包含 当前文件名 的 */
  function rebuildBacklinks(hits?: Map<string, OutlinkHit[]>) {
    const next = new Map<string, Backlink[]>()
    const src = hits ?? fileOutlinks.value
    for (const [path, entries] of src.entries()) {
      const fromName = nameOfPath(path) || path
      if (Array.isArray(entries)) {
        // 带行号/上下文的模式
        for (const hit of entries) {
          pushBacklink(next, hit.target, {
            fromPath: path,
            fromName,
            context: hit.context,
            line: hit.line,
          })
        }
      } else {
        // 退化模式：只有出链集合
        for (const target of entries as Set<string>) {
          pushBacklink(next, target, { fromPath: path, fromName, context: '', line: 0 })
        }
      }
    }
    backlinks.value = next
  }

  function pushBacklink(map: Map<string, Backlink[]>, target: string, item: Backlink) {
    // 同名文件可能有多个：target 可能带路径前缀，统一按末段匹配
    const key = target.replace(/\\/g, '/').split('/').pop() || target
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }

  function nameOfPath(p: string): string | null {
    const parts = p.replace(/\\/g, '/').split('/')
    const last = parts[parts.length - 1] || ''
    return last.replace(MD_EXT, '') || null
  }

  function getBacklinks(pathOrName: string): Backlink[] {
    const direct = backlinks.value.get(pathOrName)
    if (direct) return direct
    const name = nameOfPath(pathOrName)
    return name ? backlinks.value.get(name) || [] : []
  }

  function resolveWikiLink(target: string): string | null {
    return pathByName.value.get(target) || null
  }

  function getFileTags(path: string): string[] {
    return Array.from(fileTags.value.get(path) || [])
  }

  function tagList(): TagInfo[] {
    return Array.from(tags.value.values()).sort((a, b) => b.count - a.count)
  }

  function refreshIfNeeded() {
    if (Date.now() - lastScanAt.value > 5000) scanWorkspace()
  }

  /** 关闭工作区 / 切换工作区时清空上一次的扫描结果 */
  function reset() {
    scanToken++
    scanning.value = false
    lastScanAt.value = 0
    fileTags.value = new Map()
    fileOutlinks.value = new Map()
    pathByName.value = new Map()
    tags.value = new Map()
    backlinks.value = new Map()
  }

  return {
    scanning,
    lastScanAt,
    tags,
    backlinks,
    fileTags,
    scanWorkspace,
    getBacklinks,
    resolveWikiLink,
    getFileTags,
    tagList,
    refreshIfNeeded,
    reset,
  }
})

export { WIKILINK_SRC as WIKILINK_RE, TAG_SRC as TAG_RE }
