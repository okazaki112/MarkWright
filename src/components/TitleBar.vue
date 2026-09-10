<script setup lang="ts">
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useDocumentStore } from '../stores/document'
import { useThemeStore } from '../stores/theme'
import ExportMenu from './ExportMenu.vue'
import MenuBar from './MenuBar.vue'

const doc = useDocumentStore()
const theme = useThemeStore()

const titleText = computed(() => doc.titleText)

function openSettings() {
  theme.openSettings()
}
</script>

<template>
  <header class="title-bar">
    <div class="title-left">
      <div class="app-mark">
        <span class="mw">M</span><span class="w">W</span>
      </div>
      <span class="app-name">MarkWright</span>
      <MenuBar />
    </div>
    <div class="title-right">
      <span class="doc-name" :class="{ dirty: doc.isDirty }" :title="doc.activeTab?.path || '未保存'">
        {{ titleText }}
      </span>
      <span class="divider" />
      <ExportMenu />
      <button class="menu-btn icon-only" @click="openSettings" title="设置">
        <Icon icon="lucide:settings" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.title-bar {
  height: var(--title-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px 0 14px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-0);
  user-select: none;
  -webkit-app-region: drag;
}
.title-left,
.title-right {
  display: flex;
  align-items: center;
  gap: 4px;
  -webkit-app-region: no-drag;
}
.title-left {
  flex: 1;
  min-width: 0;
}
.title-right {
  flex-shrink: 0;
  max-width: 46%;
}
.app-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: linear-gradient(135deg, var(--accent) 0%, #1f6feb 100%);
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: -0.5px;
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1) inset, var(--shadow-sm);
  margin-right: 8px;
}
.app-mark .w { opacity: 0.7; margin-left: -2px; }
.app-name {
  font-size: var(--fz-md);
  font-weight: 600;
  color: var(--fg-0);
  margin-right: 8px;
}
.divider {
  width: 1px;
  height: 18px;
  background: var(--border-0);
  margin: 0 8px;
}
.doc-name {
  font-size: var(--fz-sm);
  color: var(--fg-1);
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-name.dirty { color: var(--warning); }
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  color: var(--fg-1);
  font-size: var(--fz-sm);
  transition: background var(--t-fast), color var(--t-fast);
}
.menu-btn:hover { background: var(--bg-3); color: var(--fg-0); }
.menu-btn:active { background: var(--border-0); }
.menu-btn.icon-only { padding: 0 8px; width: 32px; justify-content: center; }
.menu-btn :deep(svg) { width: 15px; height: 15px; }
</style>
