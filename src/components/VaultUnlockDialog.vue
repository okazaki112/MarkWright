<script setup lang="ts">
/**
 * 解锁弹窗 - 打开/保存加密文档时请求主密码
 * 由 useVault 的模块级 unlockRequest 驱动（任意调用方 await requestPassword 都会弹它）
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import {
  useVault,
  useVaultState,
  submitUnlockPassword,
  cancelUnlock,
} from '../composables/useVault'

const vault = useVault()
const { unlockRequest } = useVaultState()

const password = ref('')
const error = ref('')
const busy = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const open = computed(() => !!unlockRequest.value)

watch(open, async (v) => {
  if (!v) return
  password.value = ''
  error.value = ''
  await nextTick()
  inputRef.value?.focus()
})

async function submit() {
  const pw = password.value
  if (!pw) {
    error.value = '请输入主密码'
    return
  }
  busy.value = true
  try {
    const ok = await vault.verifyMasterPassword(pw)
    if (!ok) {
      error.value = '主密码错误'
      password.value = ''
      inputRef.value?.focus()
      return
    }
    submitUnlockPassword(pw)
  } catch (e) {
    error.value = String(e)
  } finally {
    busy.value = false
  }
}

function cancel() {
  cancelUnlock()
}
</script>

<template>
  <transition name="fade">
    <div v-if="open" class="overlay" @click.self="cancel">
      <div class="modal" role="dialog" aria-label="解锁加密文档">
        <header class="modal-header">
          <h2><Icon icon="lucide:lock" /> {{ unlockRequest?.title }}</h2>
        </header>
        <div class="modal-body">
          <p v-if="unlockRequest?.hint" class="hint" :title="unlockRequest.hint">
            {{ unlockRequest.hint }}
          </p>
          <input
            ref="inputRef"
            v-model="password"
            type="password"
            placeholder="主密码"
            autocomplete="off"
            @keydown.enter.prevent="submit"
            @keydown.esc.prevent="cancel"
          />
          <div v-if="error" class="error">{{ error }}</div>
          <div class="actions">
            <button class="ghost" :disabled="busy" @click="cancel">取消</button>
            <button class="primary" :disabled="busy" @click="submit">
              <Icon icon="lucide:unlock" /> 解锁
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}
.modal {
  width: 400px;
  max-width: 90vw;
  background: var(--bg-elevated, var(--bg-1));
  border: 1px solid var(--border-0);
  border-radius: var(--radius-lg, var(--radius-md));
  box-shadow: var(--shadow-lg, var(--shadow-md));
  overflow: hidden;
}
.modal-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-0);
}
.modal-header h2 {
  margin: 0;
  font-size: var(--fz-md);
  display: flex;
  align-items: center;
  gap: 6px;
}
.modal-header :deep(svg) { width: 16px; height: 16px; }
.modal-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  margin: 0;
  font-size: var(--fz-xs);
  color: var(--fg-3);
  font-family: var(--font-mono);
  word-break: break-all;
  max-height: 3.6em;
  overflow: hidden;
}
input {
  padding: 9px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-sm);
  color: var(--fg-0);
  font-size: var(--fz-sm);
}
input:focus { outline: none; border-color: var(--accent); }
.error { color: var(--danger); font-size: var(--fz-xs); }
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.actions button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: var(--radius-md);
  font-size: var(--fz-sm);
  background: var(--bg-2);
  color: var(--fg-0);
  transition: background var(--t-fast);
}
.actions button:hover:not(:disabled) { background: var(--bg-3); }
.actions button.primary { background: var(--accent); color: #fff; }
.actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.actions :deep(svg) { width: 14px; height: 14px; }

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base, 0.15s); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
