<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useDocumentStore } from '../stores/document'
import { useUIStore } from '../stores/ui'
import { useBusyStore } from '../stores/busy'

const doc = useDocumentStore()
const ui = useUIStore()
const busy = useBusyStore()

const saveState = computed(() => {
  if (doc.isDirty) return { text: '未保存', color: 'var(--warning)' }
  if (doc.activeTab?.lastSavedAt && doc.activeTab.lastSavedAt > 0) {
    return { text: '已保存', color: 'var(--success)' }
  }
  return { text: '新建', color: 'var(--fg-3)' }
})

const autoSaveText = computed(() => {
  const t = doc.activeTab
  if (!t?.lastSavedAt) return null
  const d = new Date(t.lastSavedAt)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `自动保存 ${hh}:${mm}:${ss}`
})

const pathText = computed(() => doc.activeTab?.path || '未保存到磁盘')
</script>

<template>
  <footer class="status-bar">
    <div class="left">
      <button class="iconbtn" @click="ui.toggleSidebar" :title="ui.sidebarOpen ? '隐藏侧边栏' : '显示侧边栏'">
        <Icon :icon="ui.sidebarOpen ? 'lucide:panel-left-close' : 'lucide:panel-left-open'" />
      </button>
      <span class="sep" />
      <span class="pill" :style="{ color: saveState.color }">
        <span class="dot" :style="{ background: saveState.color }" />
        {{ saveState.text }}
      </span>
      <span v-if="busy.isBusy" class="busy" role="status">
        <span class="spinner" />{{ busy.label || '处理中…' }}
      </span>
      <span v-else-if="autoSaveText" class="auto-save">
        <Icon icon="lucide:cloud-check" />
        {{ autoSaveText }}
      </span>
      <span class="sep" />
      <span class="item" :title="pathText">
        <Icon icon="lucide:file" />
        <span class="text">{{ doc.activeTab?.name ?? '无' }}</span>
      </span>
    </div>
    <div class="right">
      <button class="item" @click="ui.toggleScrollSync" :title="ui.scrollSync ? '已开启滚动同步' : '已关闭滚动同步'">
        <Icon :icon="ui.scrollSync ? 'lucide:link-2' : 'lucide:link-2-off'" :style="{ opacity: ui.scrollSync ? 1 : 0.4 }" />
        <span class="text">同步</span>
      </button>
      <span class="sep" />
      <button class="item" :class="{ active: ui.viewMode === 'editor' }" @click="ui.setViewMode('editor')" title="仅编辑器">
        <Icon icon="lucide:square-pen" />
      </button>
      <button class="item" :class="{ active: ui.viewMode === 'split' }" @click="ui.setViewMode('split')" title="分屏">
        <Icon icon="lucide:columns-2" />
      </button>
      <button class="item" :class="{ active: ui.viewMode === 'preview' }" @click="ui.setViewMode('preview')" title="仅预览">
        <Icon icon="lucide:eye" />
      </button>
      <span class="sep" />
      <span class="item"><span class="text">行 {{ doc.lineCount }}</span></span>
      <span class="item"><span class="text">字 {{ doc.wordCount }}</span></span>
      <span class="item">
        <span class="text">第 {{ doc.cursor.line }}:{{ doc.cursor.col }}</span>
      </span>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  height: var(--status-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  background: var(--bg-2);
  border-top: 1px solid var(--border-0);
  font-size: var(--fz-xs);
  color: var(--fg-2);
  user-select: none;
  gap: 4px;
}
.left, .right { display: flex; align-items: center; gap: 2px; }

.iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--fg-2);
  transition: background var(--t-fast), color var(--t-fast);
}
.iconbtn:hover { background: var(--bg-3); color: var(--fg-0); }
.iconbtn :deep(svg) { width: 13px; height: 13px; }

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px;
  font-weight: 500;
}
.dot { width: 7px; height: 7px; border-radius: 50%; }

.auto-save {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--fg-2);
  font-size: var(--fz-xs);
}
.auto-save :deep(svg) { width: 11px; height: 11px; color: var(--success); }

/* 处理中 spinner */
.busy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 6px;
  color: var(--accent);
}
.spinner {
  width: 10px;
  height: 10px;
  border: 2px solid color-mix(in srgb, var(--accent) 30%, transparent);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 7px;
  height: 22px;
  border-radius: 4px;
  color: var(--fg-2);
  transition: background var(--t-fast), color var(--t-fast);
}
.item:hover { background: var(--bg-3); color: var(--fg-1); }
.item.active { color: var(--accent); background: var(--bg-3); }
.item :deep(svg) { width: 12px; height: 12px; }
.text { font-variant-numeric: tabular-nums; }

.sep { width: 1px; height: 14px; background: var(--border-0); margin: 0 2px; }
</style>
