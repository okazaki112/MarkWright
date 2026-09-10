<script setup lang="ts">
import { reactive } from 'vue'
import { Icon } from '@iconify/vue'
import { useDocumentStore, type Tab } from '../stores/document'
import { useFileSystem } from '../composables/useFileSystem'
import { useWorkspaceActions } from '../composables/useWorkspaceActions'

const doc = useDocumentStore()
const fs = useFileSystem()
const wsActions = useWorkspaceActions()

const menu = reactive({ show: false, x: 0, y: 0, id: '' as string })

function switchTo(t: Tab) {
  doc.activate(t.id)
}

async function closeById(id: string) {
  const t = doc.tabs.find((x) => x.id === id)
  if (t && t.content !== t.savedContent) {
    const choice = confirm(`「${t.name}」有未保存的修改，是否保存？`)
    if (choice) {
      doc.activate(id)
      await fs.save()
    }
  }
  doc.closeTab(id)
}

async function close(t: Tab, e: Event) {
  e.stopPropagation()
  e.preventDefault()
  await closeById(t.id)
}

function pin(t: Tab, e: Event) {
  e.stopPropagation()
  doc.pinTab(t.id)
}

function middleClick(t: Tab, e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault()
    close(t, e)
  }
}

function onContext(t: Tab, e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  menu.show = true
  menu.x = e.clientX
  menu.y = e.clientY
  menu.id = t.id
}

function closeMenu() {
  menu.show = false
}

function ctxRevert() {
  const id = menu.id
  closeMenu()
  fs.confirmRevert(id)
}

function ctxClose() {
  const id = menu.id
  closeMenu()
  closeById(id)
}

function ctxPin() {
  const id = menu.id
  closeMenu()
  doc.pinTab(id)
}

function ctxSetWorkspace() {
  const id = menu.id
  closeMenu()
  const t = doc.tabs.find((x) => x.id === id)
  if (t && t.path) wsActions.setFromPath(t.path)
}

function ctxOpenFolder() {
  const id = menu.id
  closeMenu()
  const t = doc.tabs.find((x) => x.id === id)
  if (t && t.path) fs.openFileFolder(t.path)
}
</script>

<template>
  <div class="tabbar">
    <div class="tabs">
      <div
        v-for="t in doc.tabs"
        :key="t.id"
        class="tab"
        :class="{
          active: t.id === doc.activeId,
          dirty: t.content !== t.savedContent,
        }"
        @click="switchTo(t)"
        @mousedown="middleClick(t, $event)"
        @contextmenu="onContext(t, $event)"
        :title="t.path || '未保存'"
      >
        <Icon
          :icon="t.isPinned ? 'lucide:pin' : 'lucide:file-text'"
          class="tab-icon"
        />
        <span class="tab-name">{{ t.content !== t.savedContent ? '● ' : '' }}{{ t.name }}</span>
        <button class="tab-btn" @click="pin(t, $event)" v-if="t.isPinned" title="取消固定">
          <Icon icon="lucide:pin-off" />
        </button>
        <button
          class="tab-btn close"
          @mousedown.stop
          @click.stop="close(t, $event)"
          title="关闭"
          type="button"
        >
          <Icon icon="lucide:x" />
        </button>
      </div>
    </div>
    <button class="newtab" @click="fs.newFile" title="新建标签页 (Ctrl/Cmd+N)">
      <Icon icon="lucide:plus" />
    </button>
  </div>

  <!-- 标签页右键菜单 -->
  <template v-if="menu.show">
    <div class="ctx-backdrop" @click="closeMenu" @contextmenu.prevent="closeMenu" />
    <div class="ctx-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
      <button
        class="ctx-item"
        :disabled="!doc.tabs.find((t) => t.id === menu.id) || doc.tabs.find((t) => t.id === menu.id)!.content === doc.tabs.find((t) => t.id === menu.id)!.savedContent"
        @click="ctxRevert"
      >
        <Icon icon="lucide:undo-2" />
        <span>放弃未保存的修改</span>
      </button>
      <button class="ctx-item" @click="ctxPin">
        <Icon icon="lucide:pin" />
        <span>{{ doc.tabs.find((t) => t.id === menu.id)?.isPinned ? '取消固定' : '固定标签' }}</span>
      </button>
      <button
        class="ctx-item"
        :disabled="!doc.tabs.find((t) => t.id === menu.id)?.path"
        @click="ctxSetWorkspace"
      >
        <Icon icon="lucide:folder-tree" />
        <span>设为工作区</span>
      </button>
      <button
        class="ctx-item"
        :disabled="!doc.tabs.find((t) => t.id === menu.id)?.path"
        @click="ctxOpenFolder"
      >
        <Icon icon="lucide:folder-open" />
        <span>打开文件路径文件夹</span>
      </button>
      <button class="ctx-item danger" @click="ctxClose">
        <Icon icon="lucide:x" />
        <span>关闭标签</span>
      </button>
    </div>
  </template>
</template>

<style scoped>
.tabbar {
  display: flex;
  align-items: stretch;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-0);
  height: 34px;
  min-height: 34px;
  user-select: none;
}

.tabs {
  flex: 1;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}
.tabs::-webkit-scrollbar { height: 4px; }

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  padding: 0 8px 0 12px;
  border-right: 1px solid var(--border-0);
  font-size: var(--fz-sm);
  color: var(--fg-2);
  cursor: pointer;
  position: relative;
  min-width: 120px;
  max-width: 220px;
  transition: background var(--t-fast), color var(--t-fast);
  white-space: nowrap;
}
.tab::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: transparent;
  transition: background var(--t-fast);
}
.tab:hover { background: var(--bg-3); color: var(--fg-0); }
.tab.active {
  background: var(--bg-0);
  color: var(--fg-0);
}
.tab.active::after { background: var(--accent); }
.tab.dirty .tab-name { color: var(--warning); }

.tab-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--fg-3);
}
.tab.active .tab-icon { color: var(--accent); }
.tab.dirty .tab-icon { color: var(--warning); }

.tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--fg-3);
  opacity: 1;
  transition: opacity var(--t-fast), background var(--t-fast), color var(--t-fast);
  flex-shrink: 0;
  pointer-events: auto;
}
.tab-btn:hover { background: var(--border-0); color: var(--fg-0); }
.tab-btn.close:hover { color: var(--danger); background: rgba(248, 81, 73, 0.15); }
.tab-btn :deep(svg) { width: 12px; height: 12px; pointer-events: none; }

.newtab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 100%;
  color: var(--fg-2);
  transition: background var(--t-fast), color var(--t-fast);
}
.newtab:hover { background: var(--bg-3); color: var(--fg-0); }
.newtab :deep(svg) { width: 14px; height: 14px; }

/* 右键上下文菜单 */
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
}
.ctx-menu {
  position: fixed;
  z-index: 91;
  min-width: 180px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 4px;
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 4px;
  color: var(--fg-0);
  font-size: var(--fz-sm);
  text-align: left;
  transition: background var(--t-fast);
}
.ctx-item :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.ctx-item:hover:not(:disabled) { background: var(--bg-3); }
.ctx-item:disabled { color: var(--fg-3); cursor: not-allowed; opacity: 0.6; }
.ctx-item.danger { color: var(--danger); }
.ctx-item.danger:hover { background: rgba(248, 81, 73, 0.15); }
</style>
