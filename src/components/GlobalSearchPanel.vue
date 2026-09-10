<script setup lang="ts">
/**
 * GlobalSearchPanel - 全局搜索/替换（Ctrl+Shift+F）
 * - 当前文档内查找 + 替换
 * - 命中计数、上下导航
 * - 用 CodeMirror state 直接搜索
 */
import { ref, onMounted, nextTick, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useCommandStore } from '../stores/commands'
import { useDocumentStore } from '../stores/document'

const cmds = useCommandStore()
const doc = useDocumentStore()

const query = ref('')
const replace = ref('')
const caseSensitive = ref(false)
const useRegex = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const matches = computed(() => {
  if (!query.value) return []
  const text = doc.activeTab?.content ?? ''
  const flags = caseSensitive.value ? 'g' : 'gi'
  try {
    const pattern = useRegex.value
      ? new RegExp(query.value, flags)
      : new RegExp(query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    const out: { from: number; to: number; line: number }[] = []
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      const from = m.index
      const to = from + m[0].length
      const before = text.slice(0, from)
      const line = before.split('\n').length
      out.push({ from, to, line })
      if (m[0].length === 0) pattern.lastIndex++
      if (out.length > 1000) break
    }
    return out
  } catch {
    return []
  }
})

const currentIdx = ref(0)
function next() {
  if (matches.value.length === 0) return
  currentIdx.value = (currentIdx.value + 1) % matches.value.length
  jump()
}
function prev() {
  if (matches.value.length === 0) return
  currentIdx.value = (currentIdx.value - 1 + matches.value.length) % matches.value.length
  jump()
}
function jump() {
  const m = matches.value[currentIdx.value]
  if (!m) return
  // 同时滚动编辑器与预览
  window.dispatchEvent(
    new CustomEvent('markwright:editor-jump-to', { detail: { from: m.from, to: m.to } })
  )
  window.dispatchEvent(
    new CustomEvent('markwright:jump-to-line', { detail: { line: m.line } })
  )
}

function doReplace() {
  if (!query.value || matches.value.length === 0) return
  const text = doc.activeTab?.content ?? ''
  // 从后往前替换以保持索引稳定
  const flags = caseSensitive.value ? 'g' : 'gi'
  const pattern = useRegex.value
    ? new RegExp(query.value, flags)
    : new RegExp(query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
  const newText = text.replace(pattern, replace.value)
  if (newText !== text) {
    doc.setContent(newText)
  }
}

function doReplaceAll() {
  if (!query.value) return
  const text = doc.activeTab?.content ?? ''
  const flags = caseSensitive.value ? 'g' : 'gi'
  const pattern = useRegex.value
    ? new RegExp(query.value, flags)
    : new RegExp(query.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
  const newText = text.replace(pattern, replace.value)
  if (newText !== text) doc.setContent(newText)
}

function close() {
  cmds.closeSearch()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close() }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) prev()
    else next()
  }
}

onMounted(() => nextTick(() => inputRef.value?.focus()))
</script>

<template>
  <transition name="fade">
    <div v-if="cmds.searchOpen" class="overlay" @click.self="close">
      <div class="panel">
        <div class="row">
          <Icon icon="lucide:search" class="lead" />
          <input
            ref="inputRef"
            v-model="query"
            placeholder="查找…"
            @keydown="onKey"
            spellcheck="false"
          />
          <span class="count">
            <template v-if="matches.length > 0">
              {{ currentIdx + 1 }} / {{ matches.length }}
            </template>
            <template v-else-if="query">无结果</template>
          </span>
          <button class="opt" :class="{ on: caseSensitive }" @click="caseSensitive = !caseSensitive" title="区分大小写">Aa</button>
          <button class="opt" :class="{ on: useRegex }" @click="useRegex = !useRegex" title="正则">.*</button>
          <button class="nav" @click="prev" title="上一个 (Shift+Enter)"><Icon icon="lucide:chevron-up" /></button>
          <button class="nav" @click="next" title="下一个 (Enter)"><Icon icon="lucide:chevron-down" /></button>
          <span class="esc" @click="close">ESC</span>
        </div>
        <div class="row replace-row">
          <Icon icon="lucide:replace" class="lead" />
          <input v-model="replace" placeholder="替换为…" @keydown="onKey" spellcheck="false" />
          <button class="action" @click="doReplace" :disabled="matches.length === 0">替换</button>
          <button class="action" @click="doReplaceAll" :disabled="matches.length === 0">全部替换</button>
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
  width: 620px; max-width: 90vw;
  background: var(--bg-elevated); border: 1px solid var(--border-0);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  overflow: hidden; animation: in 0.18s ease;
}
@keyframes in { from { opacity: 0; transform: translateY(-12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.row {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; border-bottom: 1px solid var(--border-0);
}
.replace-row { border-bottom: 0; background: var(--bg-1); }
.row .lead { color: var(--fg-3); width: 14px; height: 14px; }
.row input { flex: 1; font-size: var(--fz-md); color: var(--fg-0); }
.row input::placeholder { color: var(--fg-3); }
.count { font-size: var(--fz-xs); color: var(--fg-2); min-width: 50px; text-align: right; font-variant-numeric: tabular-nums; }
.opt {
  font-size: 10px; font-family: var(--font-mono); font-weight: 600;
  width: 26px; height: 24px; border-radius: 4px;
  color: var(--fg-2); background: var(--bg-2);
  transition: all var(--t-fast);
}
.opt:hover { background: var(--bg-3); color: var(--fg-0); }
.opt.on { background: var(--accent); color: white; }
.nav {
  width: 24px; height: 24px; border-radius: 4px;
  color: var(--fg-2);
}
.nav:hover { background: var(--bg-3); color: var(--fg-0); }
.nav :deep(svg) { width: 12px; height: 12px; }
.action {
  padding: 4px 10px; border-radius: 4px;
  font-size: var(--fz-xs); color: var(--fg-1);
  background: var(--bg-2);
  transition: all var(--t-fast);
}
.action:hover:not(:disabled) { background: var(--bg-3); color: var(--fg-0); }
.action:disabled { opacity: 0.4; cursor: not-allowed; }
.esc { font-size: var(--fz-xs); color: var(--fg-2); padding: 2px 6px; background: var(--bg-2); border: 1px solid var(--border-0); border-radius: 4px; cursor: pointer; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
