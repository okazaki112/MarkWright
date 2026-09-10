<script setup lang="ts">
/**
 * QuickOpenPanel - 快速打开文件（Ctrl+P）
 * - 列示 workspace 全部 .md 文件
 * - 模糊匹配
 * - 选中即打开
 */
import { computed, ref, onMounted, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useCommandStore } from '../stores/commands'
import { useDocumentStore } from '../stores/document'
import { useWorkspaceStore, type FsNode } from '../stores/workspace'
import { useToastStore } from '../stores/toast'
import { readTextFile } from '@tauri-apps/plugin-fs'

const cmds = useCommandStore()
const doc = useDocumentStore()
const ws = useWorkspaceStore()
const toasts = useToastStore()

const query = ref('')
const activeIdx = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

function flattenFiles(nodes: FsNode[]): FsNode[] {
  const out: FsNode[] = []
  for (const n of nodes) {
    if (!n.isDir) out.push(n)
    if (n.children) flattenFiles(n.children)
  }
  return out
}

const allFiles = computed<FsNode[]>(() => flattenFiles(ws.tree))
const list = computed(() => {
  if (!query.value) return allFiles.value
  const q = query.value.toLowerCase()
  return allFiles.value.filter(
    (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
  )
})

function close() { cmds.closeQuickOpen() }

async function open(path: string) {
  try {
    const text = await readTextFile(path)
    doc.loadFromPath(path, text)
    close()
  } catch (e) {
    toasts.error('打开失败', String(e))
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close() }
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(list.value.length - 1, activeIdx.value + 1) }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(0, activeIdx.value - 1) }
  if (e.key === 'Enter') {
    e.preventDefault()
    const f = list.value[activeIdx.value]
    if (f) open(f.path)
  }
}

onMounted(() => nextTick(() => inputRef.value?.focus()))
</script>

<template>
  <transition name="fade">
    <div v-if="cmds.quickOpenOpen" class="overlay" @click.self="close">
      <div class="panel">
        <div class="input-row">
          <Icon icon="lucide:file-search" class="lead" />
          <input
            ref="inputRef"
            v-model="query"
            placeholder="输入文件名跳转…"
            @keydown="onKey"
            spellcheck="false"
          />
          <span class="esc" @click="close">ESC</span>
        </div>
        <div class="results">
          <div v-if="allFiles.length === 0" class="empty">
            <Icon icon="lucide:folder-open" />
            <p>请先在左侧打开一个工作区</p>
          </div>
          <div v-else-if="list.length === 0" class="empty">
            <Icon icon="lucide:search-x" />
            <p>没有匹配的文件</p>
          </div>
          <button
            v-for="(f, i) in list.slice(0, 50)"
            :key="f.path"
            class="item"
            :class="{ active: i === activeIdx }"
            @click="open(f.path)"
            @mouseenter="activeIdx = i"
          >
            <Icon icon="lucide:file-text" class="ico" />
            <div class="info">
              <div class="name">{{ f.name }}</div>
              <div class="path">{{ f.path }}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: 200; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh; backdrop-filter: blur(3px);
}
.panel {
  width: 560px; max-width: 90vw; max-height: 70vh;
  background: var(--bg-elevated); border: 1px solid var(--border-0);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; overflow: hidden;
  animation: in 0.18s ease;
}
@keyframes in { from { opacity: 0; transform: translateY(-12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.input-row {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--border-0);
}
.input-row .lead { color: var(--fg-3); width: 16px; height: 16px; }
.input-row input { flex: 1; font-size: var(--fz-lg); color: var(--fg-0); }
.input-row input::placeholder { color: var(--fg-3); }
.input-row .esc { font-size: var(--fz-xs); color: var(--fg-2); padding: 2px 6px; background: var(--bg-2); border: 1px solid var(--border-0); border-radius: 4px; cursor: pointer; }
.results { overflow: auto; padding: 6px 0; }
.empty { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: var(--fg-3); gap: 8px; }
.empty :deep(svg) { width: 28px; height: 28px; opacity: 0.5; }
.empty p { margin: 0; font-size: var(--fz-sm); }
.item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 7px 14px; text-align: left;
  color: var(--fg-1); font-size: var(--fz-sm);
  border-left: 2px solid transparent;
  transition: background var(--t-fast), color var(--t-fast);
}
.item.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--fg-0); border-left-color: var(--accent); }
.item .ico { width: 14px; height: 14px; color: var(--fg-3); flex-shrink: 0; }
.item.active .ico { color: var(--accent); }
.item .info { flex: 1; min-width: 0; }
.item .name { color: var(--fg-0); font-weight: 500; }
.item .path { color: var(--fg-3); font-size: var(--fz-xs); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
