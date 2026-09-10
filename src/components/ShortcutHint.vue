<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { Icon } from '@iconify/vue'

const visible = ref(true)
let timer: number | undefined

function show(ms = 2200) {
  visible.value = true
  clearTimeout(timer)
  timer = window.setTimeout(() => { visible.value = false }, ms)
}

onMounted(() => { show() })
onBeforeUnmount(() => clearTimeout(timer))

// 任意键盘事件时显示一下
let onKey: ((e: KeyboardEvent) => void) | null = null
// 菜单「帮助 → 显示键盘快捷键」：常显 6s
let onShowCmd: (() => void) | null = null
onMounted(() => {
  onKey = () => show()
  window.addEventListener('keydown', onKey)
  onShowCmd = () => show(6000)
  window.addEventListener('markwright:show-shortcuts', onShowCmd)
})
onBeforeUnmount(() => {
  if (onKey) window.removeEventListener('keydown', onKey)
  if (onShowCmd) window.removeEventListener('markwright:show-shortcuts', onShowCmd)
})
</script>

<template>
  <div v-if="visible" class="shortcut-hint" @click="visible = false">
    <div class="hint-title">
      <Icon icon="lucide:keyboard" />
      快捷键
    </div>
    <div class="hint-grid">
      <div><kbd>Ctrl/⌘ + N</kbd><span>新建文件</span></div>
      <div><kbd>Ctrl/⌘ + O</kbd><span>打开文件</span></div>
      <div><kbd>Ctrl/⌘ + S</kbd><span>保存</span></div>
      <div><kbd>Ctrl/⌘ + ⇧ + S</kbd><span>另存为</span></div>
      <div><kbd>Ctrl/⌘ + B</kbd><span>加粗</span></div>
      <div><kbd>Ctrl/⌘ + I</kbd><span>斜体</span></div>
      <div><kbd>Ctrl/⌘ + K</kbd><span>插入链接</span></div>
      <div><kbd>Ctrl/⌘ + \</kbd><span>切换视图</span></div>
    </div>
    <div class="hint-foot">点击任意位置关闭 · 自动隐藏</div>
  </div>
</template>

<style scoped>
.shortcut-hint {
  position: absolute;
  right: 24px;
  bottom: 36px;
  width: 360px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 16px 18px 12px;
  z-index: 50;
  user-select: none;
  animation: in var(--t-slow);
}
@keyframes in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.hint-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: var(--fz-md);
  color: var(--fg-0);
  margin-bottom: 12px;
}
.hint-title :deep(svg) { width: 16px; height: 16px; }

.hint-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 14px;
  font-size: var(--fz-sm);
  color: var(--fg-1);
}
.hint-grid > div {
  display: flex;
  align-items: center;
  gap: 6px;
}
.hint-grid kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  background: var(--bg-3);
  border: 1px solid var(--border-0);
  border-bottom-width: 2px;
  border-radius: 4px;
  color: var(--fg-0);
}

.hint-foot {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-0);
  font-size: var(--fz-xs);
  color: var(--fg-3);
  text-align: center;
}
</style>
