<script setup lang="ts">
/**
 * 顶部菜单栏
 * 菜单项直接由「命令注册表」驱动（与命令面板同源），
 * 因此任何新增命令只要填好 group，就会自动出现在对应菜单里。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useCommandStore, type Command } from '../stores/commands'

const cmds = useCommandStore()
const openId = ref<string | null>(null)
const rootRef = ref<HTMLElement | null>(null)

interface MenuDef {
  id: string
  label: string
  /** 该菜单聚合的命令分组 */
  groups: string[]
}

const MENUS: MenuDef[] = [
  { id: 'file', label: '文件', groups: ['文件', '工作区'] },
  { id: 'edit', label: '编辑', groups: ['编辑'] },
  { id: 'format', label: '格式', groups: ['格式'] },
  { id: 'view', label: '视图', groups: ['视图'] },
  { id: 'theme', label: '主题', groups: ['主题'] },
  { id: 'focus', label: '专注', groups: ['专注', '模板'] },
  { id: 'export', label: '导出', groups: ['导出'] },
  { id: 'help', label: '帮助', groups: ['帮助', '加密', '全局'] },
]

const itemsByMenu = computed<Record<string, Command[]>>(() => {
  const out: Record<string, Command[]> = {}
  for (const m of MENUS) {
    out[m.id] = cmds.commands.filter((c) => m.groups.includes(c.group))
  }
  return out
})

function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}
/** 已有菜单展开时，鼠标划过即切换（符合桌面端菜单习惯） */
function hover(id: string) {
  if (openId.value) openId.value = id
}
function run(c: Command) {
  openId.value = null
  cmds.execute(c.id)
}
function close() {
  openId.value = null
}

function onDocMouseDown(e: MouseEvent) {
  if (!openId.value) return
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) close()
}
function onDocKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown, true)
  document.addEventListener('keydown', onDocKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMouseDown, true)
  document.removeEventListener('keydown', onDocKey)
})
</script>

<template>
  <nav ref="rootRef" class="menubar">
    <div v-for="m in MENUS" :key="m.id" class="menu-root">
      <button
        class="menu-title"
        :class="{ open: openId === m.id }"
        @click="toggle(m.id)"
        @mouseenter="hover(m.id)"
      >
        {{ m.label }}
      </button>
      <div v-if="openId === m.id" class="menu-panel">
        <template v-if="itemsByMenu[m.id].length">
          <button
            v-for="c in itemsByMenu[m.id]"
            :key="c.id"
            class="menu-item"
            :title="c.title"
            @click="run(c)"
          >
            <Icon v-if="c.icon" :icon="c.icon" class="mi-icon" />
            <span class="mi-title">{{ c.title }}</span>
            <span v-if="c.shortcut" class="mi-sc">{{ c.shortcut }}</span>
          </button>
        </template>
        <div v-else class="menu-empty">暂无可用项</div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.menubar {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}
.menu-root {
  position: relative;
}
.menu-title {
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  font-size: var(--fz-sm);
  color: var(--fg-1);
  transition: background var(--t-fast), color var(--t-fast);
}
.menu-title:hover,
.menu-title.open {
  background: var(--bg-3);
  color: var(--fg-0);
}

.menu-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-height: min(70vh, 520px);
  overflow-y: auto;
  padding: 6px;
  background: var(--bg-elevated, var(--bg-1));
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 400;
  animation: menuIn 0.12s ease;
}
@keyframes menuIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--fz-sm);
  color: var(--fg-1);
  text-align: left;
  transition: background var(--t-fast), color var(--t-fast);
}
.menu-item:hover {
  background: var(--accent-soft, var(--bg-2));
  color: var(--fg-0);
}
.mi-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  opacity: 0.85;
}
.mi-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mi-sc {
  flex-shrink: 0;
  font-size: var(--fz-xs);
  color: var(--fg-3);
  font-family: var(--font-mono);
}
.menu-empty {
  padding: 8px 10px;
  font-size: var(--fz-xs);
  color: var(--fg-3);
}
</style>
