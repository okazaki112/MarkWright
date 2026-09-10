<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { EditorActions } from '../composables/useEditorActions'

const props = defineProps<{ actions: EditorActions }>()

type Tool = {
  id: string
  label: string
  icon: string
  shortcut?: string
  run: () => void
  group: number
}

const groups: Tool[][] = [
  [
    { id: 'undo', label: '撤销', icon: 'lucide:undo-2', shortcut: 'Ctrl+Z', run: () => props.actions.undo(), group: 0 },
    { id: 'redo', label: '重做', icon: 'lucide:redo-2', shortcut: 'Ctrl+Y', run: () => props.actions.redo(), group: 0 },
  ],
  [
    { id: 'h1', label: '一级标题', icon: 'lucide:heading-1', shortcut: 'Ctrl+1', run: () => props.actions.h1(), group: 1 },
    { id: 'h2', label: '二级标题', icon: 'lucide:heading-2', shortcut: 'Ctrl+2', run: () => props.actions.h2(), group: 1 },
    { id: 'h3', label: '三级标题', icon: 'lucide:heading-3', shortcut: 'Ctrl+3', run: () => props.actions.h3(), group: 1 },
  ],
  [
    { id: 'bold', label: '加粗', icon: 'lucide:bold', shortcut: 'Ctrl+B', run: () => props.actions.bold(), group: 2 },
    { id: 'italic', label: '斜体', icon: 'lucide:italic', shortcut: 'Ctrl+I', run: () => props.actions.italic(), group: 2 },
    { id: 'strike', label: '删除线', icon: 'lucide:strikethrough', run: () => props.actions.strike(), group: 2 },
    { id: 'code', label: '行内代码', icon: 'lucide:code', run: () => props.actions.code(), group: 2 },
  ],
  [
    { id: 'ul', label: '无序列表', icon: 'lucide:list', shortcut: 'Ctrl+Shift+8', run: () => props.actions.ul(), group: 3 },
    { id: 'ol', label: '有序列表', icon: 'lucide:list-ordered', shortcut: 'Ctrl+Shift+7', run: () => props.actions.ol(), group: 3 },
    { id: 'task', label: '任务列表', icon: 'lucide:list-checks', run: () => props.actions.task(), group: 3 },
    { id: 'quote', label: '引用', icon: 'lucide:quote', shortcut: 'Ctrl+Shift+9', run: () => props.actions.quote(), group: 3 },
  ],
  [
    { id: 'link', label: '链接', icon: 'lucide:link', shortcut: 'Ctrl+K', run: () => props.actions.link(), group: 4 },
    { id: 'image', label: '图片', icon: 'lucide:image', run: () => props.actions.image(), group: 4 },
    { id: 'codeblock', label: '代码块', icon: 'lucide:square-code', run: () => props.actions.codeBlock(), group: 4 },
    { id: 'table', label: '表格', icon: 'lucide:table', run: () => props.actions.table(), group: 4 },
    { id: 'hr', label: '分割线', icon: 'lucide:minus', run: () => props.actions.hr(), group: 4 },
  ],
]
</script>

<template>
  <div class="toolbar">
    <template v-for="(group, gi) in groups" :key="gi">
      <div class="group">
        <button
          v-for="t in group"
          :key="t.id"
          class="tbtn"
          :title="t.shortcut ? `${t.label}（${t.shortcut}）` : t.label"
          @click="t.run"
        >
          <Icon :icon="t.icon" />
        </button>
      </div>
      <span v-if="gi < groups.length - 1" class="sep" />
    </template>
  </div>
</template>

<style scoped>
.toolbar {
  height: var(--toolbar-h);
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border-0);
  overflow-x: auto;
  user-select: none;
  gap: 0;
}

.group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.tbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  color: var(--fg-1);
  transition: background var(--t-fast), color var(--t-fast);
}
.tbtn:hover {
  background: var(--bg-3);
  color: var(--fg-0);
}
.tbtn:active {
  background: var(--border-0);
  transform: translateY(0.5px);
}
.tbtn :deep(svg) {
  width: 16px;
  height: 16px;
}

.sep {
  width: 1px;
  height: 20px;
  background: var(--border-0);
  margin: 0 6px;
  flex-shrink: 0;
}
</style>
