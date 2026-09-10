<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { Icon } from '@iconify/vue'
import { useUIStore, SIDEBAR_MIN_W, SIDEBAR_MAX_W } from '../stores/ui'
import FilesTab from './sidebar/FilesTab.vue'
import OutlinePanel from './OutlinePanel.vue'
import LinksPanel from './LinksPanel.vue'
import StatsDashboard from './StatsDashboard.vue'
import ReadabilityPanel from './ReadabilityPanel.vue'

const ui = useUIStore()
type Tab = 'files' | 'outline' | 'links' | 'stats' | 'reading'
const tab = ref<Tab>('files')

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'files',   icon: 'lucide:folder-tree', label: '文件' },
  { id: 'outline', icon: 'lucide:list-tree',   label: '大纲' },
  { id: 'links',   icon: 'lucide:link-2',      label: '链接' },
  { id: 'stats',   icon: 'lucide:flame',       label: '统计' },
  { id: 'reading', icon: 'lucide:book-open',   label: '阅读' },
]

const TITLE: Record<Tab, string> = {
  files: '文件',
  outline: '文档大纲',
  links: '链接与标签',
  stats: '写作统计',
  reading: '阅读分析',
}

/* ---------- 侧边栏宽度拖拽 ---------- */
const resizing = ref(false)
function startResize(e: MouseEvent) {
  if (!ui.sidebarOpen) return
  resizing.value = true
  e.preventDefault()
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', stopResize)
}
function onResizeMove(e: MouseEvent) {
  if (!resizing.value) return
  // 侧边栏从窗口左边缘开始，鼠标 x 即目标宽度
  ui.setSidebarWidth(Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, e.clientX)))
}
function stopResize() {
  if (!resizing.value) return
  resizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
}
onBeforeUnmount(stopResize)
</script>

<template>
  <aside class="sidebar-wrap">
    <button
      class="collapse-btn"
      :class="{ collapsed: !ui.sidebarOpen }"
      @click="ui.toggleSidebar"
      :title="ui.sidebarOpen ? '收起文件树' : '展开文件树'"
    >
      <Icon :icon="ui.sidebarOpen ? 'lucide:chevron-left' : 'lucide:chevron-right'" />
    </button>
    <aside
      class="sidebar"
      :class="{ collapsed: !ui.sidebarOpen, resizing }"
      :style="{ width: ui.sidebarWidth + 'px', minWidth: ui.sidebarWidth + 'px' }"
    >
      <div class="sb-tabs">
        <button
          v-for="t in TABS"
          :key="t.id"
          class="tab"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          <Icon :icon="t.icon" />
          <span>{{ t.label }}</span>
        </button>
      </div>

      <div class="sb-header">
        <span class="title">{{ TITLE[tab] }}</span>
      </div>

      <FilesTab v-if="tab === 'files'" />
      <OutlinePanel v-else-if="tab === 'outline'" />
      <LinksPanel v-else-if="tab === 'links'" />
      <StatsDashboard v-else-if="tab === 'stats'" />
      <ReadabilityPanel v-else />

      <div
        v-show="ui.sidebarOpen"
        class="resize-handle"
        :class="{ active: resizing }"
        title="拖动调整宽度，双击恢复默认"
        @mousedown="startResize"
        @dblclick="ui.resetSidebarWidth()"
      />
    </aside>
  </aside>
</template>

<style scoped>
.sidebar-wrap {
  display: flex;
  height: 100%;
  flex-shrink: 0;
}
.collapse-btn {
  position: relative;
  width: 14px;
  min-width: 14px;
  background: var(--bg-1);
  border-right: 1px solid var(--border-0);
  color: var(--fg-3);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10px;
}
.collapse-btn :deep(svg) { width: 12px; height: 12px; transition: transform var(--t-base); }
.collapse-btn:hover { background: var(--bg-3); color: var(--accent); }
.collapse-btn.collapsed { border-right: 1px solid var(--border-0); }
.collapse-btn.collapsed :deep(svg) { transform: rotate(0deg); }

.sidebar {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-1);
  border-right: 1px solid var(--border-0);
  overflow: hidden;
  transition: width 0.12s linear, min-width 0.12s linear;
}
/* 拖拽中关闭过渡，避免跟手延迟 */
.sidebar.resizing { transition: none; }
.sidebar.collapsed { width: 0 !important; min-width: 0 !important; border-right: 0; }

/* 宽度拖拽手柄 */
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  transition: background var(--t-fast);
  z-index: 3;
}
.resize-handle:hover,
.resize-handle.active { background: var(--accent); }

.sb-tabs {
  display: flex;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-0);
  padding: 0 4px;
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.sb-tabs::-webkit-scrollbar { display: none; }
.sb-tabs .tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 34px;
  padding: 0 8px;
  flex-shrink: 0;
  font-size: var(--fz-sm);
  color: var(--fg-2);
  border-bottom: 2px solid transparent;
  transition: color var(--t-fast), border-color var(--t-fast);
}
.sb-tabs .tab :deep(svg) { width: 13px; height: 13px; }
.sb-tabs .tab:hover { color: var(--fg-0); }
.sb-tabs .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.sb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  font-size: var(--fz-sm);
  color: var(--fg-0);
  font-weight: 600;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-0);
  flex-shrink: 0;
}
.sb-header .title { font-weight: 600; }
</style>
