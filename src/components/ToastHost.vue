<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useToastStore, type ToastKind } from '../stores/toast'

const toasts = useToastStore()

const ICON: Record<ToastKind, string> = {
  info: 'lucide:info',
  success: 'lucide:check-circle-2',
  warning: 'lucide:alert-triangle',
  error: 'lucide:alert-octagon',
}
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <transition-group name="toast">
      <div
        v-for="t in toasts.items"
        :key="t.id"
        :class="['toast', t.kind]"
        role="status"
      >
        <Icon :icon="ICON[t.kind]" class="ico" />
        <div class="content">
          <div class="text">{{ t.text }}</div>
          <div v-if="t.detail" class="detail">{{ t.detail }}</div>
        </div>
        <button class="close" @click="toasts.dismiss(t.id)" aria-label="关闭通知">
          <Icon icon="lucide:x" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: 16px;
  bottom: 36px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-width: 360px;
}
.toast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-left-width: 3px;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  pointer-events: auto;
  min-width: 240px;
}
.toast.info    { border-left-color: var(--info); }
.toast.success { border-left-color: var(--success); }
.toast.warning { border-left-color: var(--warning); }
.toast.error   { border-left-color: var(--danger); }

.ico { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
.toast.info .ico    { color: var(--info); }
.toast.success .ico { color: var(--success); }
.toast.warning .ico { color: var(--warning); }
.toast.error .ico   { color: var(--danger); }

.content { flex: 1; min-width: 0; }
.text { color: var(--fg-0); font-size: var(--fz-sm); line-height: 1.5; }
.detail { color: var(--fg-2); font-size: var(--fz-xs); margin-top: 2px; word-break: break-all; }

.close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  color: var(--fg-3);
  flex-shrink: 0;
}
.close:hover { background: var(--bg-3); color: var(--fg-0); }
.close :deep(svg) { width: 12px; height: 12px; }

.toast-enter-active, .toast-leave-active {
  transition: all 240ms cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from { opacity: 0; transform: translateX(20px); }
.toast-leave-to { opacity: 0; transform: translateX(20px); }
</style>
