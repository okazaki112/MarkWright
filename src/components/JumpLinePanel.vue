<script setup lang="ts">
/**
 * JumpLinePanel - 跳转到指定行（Ctrl+G）
 */
import { ref, onMounted, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useCommandStore } from '../stores/commands'
import { useDocumentStore } from '../stores/document'

const cmds = useCommandStore()
const doc = useDocumentStore()
const line = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

function close() {
  cmds.closeJumpLine()
  line.value = ''
}

function submit() {
  const n = parseInt(line.value, 10)
  if (!n || n < 1) return
  window.dispatchEvent(
    new CustomEvent('markwright:jump-to-line', { detail: { line: n } })
  )
  close()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close() }
  if (e.key === 'Enter') { e.preventDefault(); submit() }
}

onMounted(() => nextTick(() => inputRef.value?.focus()))
</script>

<template>
  <transition name="fade">
    <div v-if="cmds.jumpLineOpen" class="overlay" @click.self="close">
      <div class="panel">
        <div class="input-row">
          <Icon icon="lucide:arrow-down-1-0" class="lead" />
          <input
            ref="inputRef"
            v-model="line"
            type="number"
            min="1"
            placeholder="跳转到行号…"
            @keydown="onKey"
          />
          <span class="hint">共 {{ doc.lineCount }} 行</span>
          <span class="esc" @click="close">ESC</span>
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
  width: 460px; max-width: 90vw;
  background: var(--bg-elevated); border: 1px solid var(--border-0);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  overflow: hidden; animation: in 0.18s ease;
}
@keyframes in { from { opacity: 0; transform: translateY(-12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.input-row {
  display: flex; align-items: center; gap: 8px; padding: 12px 14px;
}
.input-row .lead { color: var(--fg-3); width: 16px; height: 16px; }
.input-row input {
  flex: 1; font-size: var(--fz-lg); color: var(--fg-0);
  -moz-appearance: textfield;
}
.input-row input::-webkit-outer-spin-button,
.input-row input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.input-row .hint { color: var(--fg-3); font-size: var(--fz-xs); }
.input-row .esc { font-size: var(--fz-xs); color: var(--fg-2); padding: 2px 6px; background: var(--bg-2); border: 1px solid var(--border-0); border-radius: 4px; cursor: pointer; }
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
