/**
 * 工作区状态：根目录、文件树
 * 通过 tauri-plugin-fs 读取目录
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readDir, exists, mkdir } from '@tauri-apps/plugin-fs'
import { open as openDialog } from '@tauri-apps/plugin-dialog'

export interface FsNode {
  name: string
  path: string
  isDir: boolean
  children?: FsNode[]
  expanded?: boolean
}

/** 可被编辑器读取的文本类扩展名白名单（其它扩展名如 exe/dll/bin 等不显示） */
export const READABLE_EXTS = new Set<string>([
  'md', 'markdown', 'mdx', 'txt', 'text', 'rtf', 'org', 'adoc', 'asciidoc', 'rst', 'tex', 'log',
  'json', 'jsonc', 'json5', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'config', 'properties',
  'env', 'editorconfig', 'npmrc',
  'csv', 'tsv',
  'xml', 'html', 'htm', 'xhtml', 'svg', 'vue', 'svelte',
  'css', 'scss', 'sass', 'less', 'styl', 'pcss',
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'astro', 'coffee',
  'py', 'pyw', 'rb', 'rs', 'go', 'java', 'kt', 'kts', 'c', 'h', 'cpp', 'cc', 'cxx', 'hpp', 'hxx',
  'cs', 'php', 'swift', 'scala', 'dart', 'lua', 'r', 'pl', 'pm', 'sql', 'graphql', 'gql',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd', 'nu',
  'ipynb', 'gitignore', 'gitattributes', 'gitmodules', 'dockerignore', 'license', 'lic', 'readme',
])

/** 无扩展名的常见文本文件名（README / Makefile / Dockerfile 等） */
const READABLE_NOEXT = new Set<string>([
  'readme', 'license', 'licence', 'makefile', 'dockerfile', 'cmakelists', 'authors',
  'contributing', 'changelog', 'copying', 'notice', 'changes', 'install', 'news', 'todo',
])

/** 判断文件是否可读（用于文件树过滤） */
export function isReadableFile(name: string): boolean {
  const lower = name.toLowerCase()
  const dot = lower.lastIndexOf('.')
  const ext = dot > 0 ? lower.slice(dot + 1) : ''
  if (ext) return READABLE_EXTS.has(ext)
  return READABLE_NOEXT.has(lower)
}

/** 是否显示全部文件（关闭时仅显示可读取的文本文件） */
const showAllFiles = ref(false)
export { showAllFiles }

async function buildTree(dir: string, maxDepth = 4, depth = 0): Promise<FsNode[]> {
  if (depth > maxDepth) return []
  const entries = await readDir(dir)
  const nodes: FsNode[] = []
  for (const e of entries) {
    // 跳过隐藏、node_modules、.git、target、dist
    if (e.name?.startsWith('.') || e.name === 'node_modules' || e.name === 'target' || e.name === 'dist') {
      continue
    }
    const fullPath = joinPath(dir, e.name)
    if (e.isDirectory) {
      const children = await buildTree(fullPath, maxDepth, depth + 1)
      // 过滤后无任何可见内容的目录直接隐藏
      if (children.length === 0) continue
      nodes.push({ name: e.name, path: fullPath, isDir: true, children, expanded: false })
    } else {
      // 仅显示可读取的文本文件（showAllFiles 时显示全部）
      if (!showAllFiles.value && !isReadableFile(e.name)) continue
      nodes.push({ name: e.name, path: fullPath, isDir: false })
    }
  }
  // 目录在前，文件在后，按名排序
  return nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function joinPath(base: string, name: string): string {
  if (base.includes('\\')) return base + '\\' + name
  return base + '/' + name
}

/**
 * 取文件/目录路径的父目录（用于“以当前文档所在目录作为工作区”）。
 * 关键：保留原始分隔符（Windows 用 \），不要统一成 /——
 * 否则 Tauri 的 readDir 在 Windows 下会因 / 分隔符无法解析目录而返回空。
 * 这里用纯 JS 计算，避免依赖 @tauri-apps/api/path 的 dirname（可能归一化为 / 或需额外权限）。
 */
export function parentDirOf(p: string): string {
  const sep = p.includes('\\') ? '\\' : '/'
  const norm = p.replace(/[\\/]+$/g, '') // 去掉尾部分隔符
  const idx = norm.lastIndexOf(sep)
  if (idx <= 0) return p // 无父目录（如 "a.md" 或盘符根）
  return norm.slice(0, idx)
}

export const useWorkspaceStore = defineStore('workspace', () => {
  const rootPath = ref<string | null>(null)
  const rootName = ref<string>('')
  const tree = ref<FsNode[]>([])
  const loading = ref(false)
  const visible = ref(true)

  async function openWorkspace() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: '选择工作区文件夹',
    })
    if (!selected || Array.isArray(selected)) return
    await setRoot(selected)
  }

  async function setRoot(path: string) {
    loading.value = true
    rootPath.value = path
    rootName.value = path.replace(/\\/g, '/').split('/').pop() || path
    try {
      tree.value = await buildTree(path)
    } catch (e) {
      tree.value = []
      loading.value = false
      throw e
    }
    loading.value = false
  }

  async function refresh() {
    if (!rootPath.value) return
    loading.value = true
    try {
      tree.value = await buildTree(rootPath.value)
    } catch (e) {
      tree.value = []
      console.error('刷新工作区失败', e)
    }
    loading.value = false
  }

  /** 切换工作区：重新弹出目录选择框，选了就替换当前工作区 */
  async function switchWorkspace(): Promise<boolean> {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: '切换到其他工作区文件夹',
    })
    if (!selected || Array.isArray(selected)) return false
    if (selected === rootPath.value) return false
    await setRoot(selected)
    return true
  }

  /** 关闭工作区（不清空已打开的 Tab，只是不再显示文件树） */
  function closeWorkspace() {
    rootPath.value = null
    rootName.value = ''
    tree.value = []
  }

  async function toggle(node: FsNode) {
    node.expanded = !node.expanded
    if (node.expanded && !node.children) {
      try {
        node.children = await buildTree(node.path)
      } catch (e) {
        node.children = []
        console.error('展开目录失败', e)
      }
    }
  }

  function findNode(path: string, nodes: FsNode[] = tree.value): FsNode | null {
    for (const n of nodes) {
      if (n.path === path) return n
      if (n.children) {
        const f = findNode(path, n.children)
        if (f) return f
      }
    }
    return null
  }

  async function newFile(parentDir: string, name: string) {
    const path = joinPath(parentDir, name)
    try {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await writeTextFile(path, '')
      await refresh()
      return path
    } catch (e) {
      console.error('newFile failed', e)
      return null
    }
  }

  async function newFolder(parentDir: string, name: string) {
    const path = joinPath(parentDir, name)
    try {
      await mkdir(path, { recursive: true })
      await refresh()
      return path
    } catch (e) {
      console.error('newFolder failed', e)
      return null
    }
  }

  async function checkExists(path: string) {
    try {
      return await exists(path)
    } catch {
      return false
    }
  }

  function toggleSidebar() {
    visible.value = !visible.value
  }

  /** 切换“显示全部文件”：开启时显示全部，关闭时仅显示可读取文本文件 */
  function setShowAllFiles(v: boolean) {
    showAllFiles.value = v
    if (rootPath.value) refresh()
  }

  return {
    rootPath,
    rootName,
    tree,
    loading,
    visible,
    showAllFiles,
    openWorkspace,
    switchWorkspace,
    closeWorkspace,
    setRoot,
    refresh,
    toggle,
    findNode,
    newFile,
    newFolder,
    checkExists,
    toggleSidebar,
    setShowAllFiles,
  }
})
