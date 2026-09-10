<script setup lang="ts">
/**
 * VaultDialog - 加密 / 解密文件
 * 模式：
 *   - 加密当前文件 → .md.vault
 *   - 解密 .md.vault → .md
 *   - 修改主密码（不可恢复）
 *   - 启用工作区加密（所有保存自动加密）
 */
import { ref, computed, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useVault, useVaultState } from '../composables/useVault'
import { useDocumentStore } from '../stores/document'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const vault = useVault()
const vaultState = useVaultState()
const doc = useDocumentStore()

// 每次打开时同步一次「是否已启用工作区加密」
watch(
  () => props.open,
  (open) => {
    if (!open) return
    void vault.refreshEnabled()
  },
  { immediate: true }
)

const tab = ref<'encrypt' | 'decrypt' | 'settings'>('encrypt')
const password = ref('')
const password2 = ref('')
const status = ref<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null)
const busy = ref(false)
const workspaceEncrypted = vaultState.enabled
const vaultUnlocked = vaultState.unlocked

const tab1 = computed(() => doc.activeTab)

function setOk(text: string) { status.value = { kind: 'ok', text } }
function setErr(text: string) { status.value = { kind: 'err', text } }

async function doEncryptFile() {
  if (!tab1.value?.path) {
    setErr('当前文档未保存，无法加密')
    return
  }
  busy.value = true
  try {
    // 就地加密：文件内容被 MWV1 密文替换，原明文不保留
    await vault.encryptFileInPlace(tab1.value.path)
    setOk(`已就地加密：${tab1.value.path}\n文件内容已变为密文（MWV1），原明文不再保留。`)
  } catch (e) {
    if (String(e).includes('已取消')) setErr('已取消：加密需要主密码')
    else setErr(String(e))
  } finally {
    busy.value = false
    password.value = ''
  }
}

async function doExportVaultCopy() {
  if (!tab1.value?.path) { setErr('当前文档未保存'); return }
  if (password.value.length < 6) { setErr('密码至少 6 位'); return }
  busy.value = true
  try {
    const dst = tab1.value.path + '.vault'
    await vault.encryptFile(tab1.value.path, dst, password.value)
    setOk(`已导出密文副本 → ${dst}（原文件保持不变）`)
  } catch (e) {
    setErr(String(e))
  } finally {
    busy.value = false
    password.value = ''
  }
}

async function doLock() {
  vault.lock()
  setOk('已锁定。后续保存加密文件需要重新输入主密码。')
}

async function doEncryptText() {
  if (!password.value) { setErr('请输入密码'); return }
  busy.value = true
  try {
    const ct = await vault.encryptText(tab1.value?.content ?? '', password.value)
    await navigator.clipboard.writeText(ct)
    setOk(`密文已复制到剪贴板（${ct.length} 字符）`)
  } catch (e) {
    setErr(String(e))
  } finally {
    busy.value = false
  }
}

async function doDecryptFile() {
  if (!password.value) { setErr('请输入密码'); return }
  if (!tab1.value?.path) { setErr('当前文档未保存'); return }
  busy.value = true
  try {
    const bytes = await vault.decryptFile(tab1.value.path, password.value)
    const text = new TextDecoder().decode(bytes)
    doc.setContent(text)
    setOk(`已解密（${text.length} 字符），内容已替换到编辑器（未写盘）`)
  } catch (e) {
    setErr(String(e))
  } finally {
    busy.value = false
    password.value = ''
  }
}

/** 解除加密：解密后把明文写回原路径 */
async function doDecryptInPlace() {
  if (!password.value) { setErr('请输入密码'); return }
  if (!tab1.value?.path) { setErr('当前文档未保存'); return }
  busy.value = true
  try {
    const bytes = await vault.decryptFile(tab1.value.path, password.value)
    const text = new TextDecoder().decode(bytes)
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(tab1.value.path, text)
    doc.loadFromPath(tab1.value.path, text)
    setOk(`已解除加密并写回明文：${tab1.value.path}`)
  } catch (e) {
    setErr(String(e))
  } finally {
    busy.value = false
    password.value = ''
  }
}

async function doBackup() {
  if (!tab1.value?.path) { setErr('当前文档未保存'); return }
  busy.value = true
  try {
    const result = await vault.backup(tab1.value.path)
    if (result) setOk(`已备份 → ${result}`)
    else setErr('备份失败：未设置工作区')
  } catch (e) {
    setErr(String(e))
  } finally {
    busy.value = false
  }
}

async function doSetWorkspaceEncryption() {
  if (password.value !== password2.value) {
    setErr('两次密码不一致')
    return
  }
  if (password.value.length < 6) {
    setErr('密码至少 6 位')
    return
  }
  busy.value = true
  try {
    // verifier 密文存到 Rust 侧 setting；密码仅驻内存，设置成功即视为本次会话已解锁
    await vault.setMasterPassword(password.value)
    setOk('工作区加密已启用：此后保存会把密文直接写入文件，磁盘上不再出现明文。')
  } catch (e) {
    setErr(String(e))
  } finally {
    // 用完即清，避免密码长驻组件状态
    password.value = ''
    password2.value = ''
    busy.value = false
  }
}
</script>

<template>
  <transition name="fade">
    <div v-if="open" class="overlay" @click.self="emit('close')">
      <div class="modal" role="dialog" aria-label="本地加密 Vault">
        <header class="modal-header">
          <h2><Icon icon="lucide:lock" /> 本地加密 Vault</h2>
          <button class="iconbtn" @click="emit('close')" aria-label="关闭">
            <Icon icon="lucide:x" />
          </button>
        </header>

        <nav class="tabs-nav">
          <button :class="{ active: tab === 'encrypt' }" @click="tab = 'encrypt'">加密文件</button>
          <button :class="{ active: tab === 'decrypt' }" @click="tab = 'decrypt'">解密文件</button>
          <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">工作区加密</button>
        </nav>

        <main class="modal-body">
          <!-- 加密 -->
          <section v-if="tab === 'encrypt'" class="form">
            <p class="hint">
              把当前文档<strong>就地加密</strong>为 MWV1 密文（AES-256-GCM，纯本地）。
              加密后文件内容即为密文，重新打开时会提示输入主密码。
            </p>
            <div v-if="tab1" class="file-info">
              <Icon icon="lucide:file-text" />
              <span>{{ tab1.name }}</span>
              <span v-if="tab1.path" class="path">{{ tab1.path }}</span>
            </div>
            <div class="field">
              <label>主密码（用于导出副本 / 复制密文）</label>
              <input v-model="password" type="password" placeholder="至少 6 位" />
            </div>
            <div class="actions">
              <button class="primary" :disabled="busy" @click="doEncryptFile">
                <Icon icon="lucide:lock" /> 就地加密当前文件
              </button>
              <button class="" :disabled="busy" @click="doExportVaultCopy">
                <Icon icon="lucide:file-lock" /> 导出 .md.vault 副本
              </button>
              <button class="" :disabled="busy" @click="doEncryptText">
                <Icon icon="lucide:clipboard-copy" /> 复制密文到剪贴板
              </button>
              <button class="" :disabled="busy" @click="doBackup">
                <Icon icon="lucide:archive" /> 备份明文副本
              </button>
            </div>
            <p class="warn">⚠️ 主密码无法找回；就地加密后原明文不再保留。</p>
          </section>

          <!-- 解密 -->
          <section v-else-if="tab === 'decrypt'" class="form">
            <p class="hint">
              解密当前文件。可只解密到编辑器查看，或直接写回明文（即解除加密）。
            </p>
            <div class="field">
              <label>主密码</label>
              <input v-model="password" type="password" />
            </div>
            <div class="actions">
              <button class="primary" :disabled="busy" @click="doDecryptInPlace">
                <Icon icon="lucide:file-check" /> 解密并写回明文
              </button>
              <button class="" :disabled="busy" @click="doDecryptFile">
                <Icon icon="lucide:unlock" /> 仅解密到编辑器
              </button>
            </div>
          </section>

          <!-- 设置 -->
          <section v-else class="form">
            <p class="hint">
              启用后，<strong>保存时会把密文直接写入文件</strong>（磁盘上不留明文）；
              打开加密文件时会自动提示输入主密码。
            </p>
            <div class="vault-state">
              <span :class="['badge', workspaceEncrypted ? 'on' : 'off']">
                {{ workspaceEncrypted ? '已启用' : '未启用' }}
              </span>
              <span :class="['badge', vaultUnlocked ? 'on' : 'off']">
                {{ vaultUnlocked ? '本次会话已解锁' : '未解锁' }}
              </span>
            </div>
            <template v-if="!workspaceEncrypted">
              <div class="field">
                <label>主密码</label>
                <input v-model="password" type="password" placeholder="至少 6 位" />
              </div>
              <div class="field">
                <label>确认密码</label>
                <input v-model="password2" type="password" />
              </div>
              <div class="actions">
                <button class="primary" :disabled="busy" @click="doSetWorkspaceEncryption">
                  <Icon icon="lucide:shield-check" /> 启用加密
                </button>
              </div>
            </template>
            <template v-else>
              <p class="hint">
                主密码<strong>不可更改</strong>：更改后已加密的文件将永久无法打开。
                如需换密码，请先用「解密 → 写回明文」，再重新启用。
              </p>
              <div class="actions">
                <button v-if="vaultUnlocked" :disabled="busy" @click="doLock">
                  <Icon icon="lucide:lock-keyhole" /> 立即锁定
                </button>
              </div>
            </template>
            <p class="warn">⚠️ 密码无法找回。请妥善保管！</p>
          </section>

          <div v-if="status" :class="['status', status.kind]">{{ status.text }}</div>
        </main>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  z-index: 200; display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
}
.modal {
  width: 520px; max-width: 90vw;
  background: var(--bg-elevated); border: 1px solid var(--border-0);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; overflow: hidden;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border-0);
}
.modal-header h2 { margin: 0; font-size: var(--fz-lg); display: flex; align-items: center; gap: 6px; }
.iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px; color: var(--fg-2);
}
.iconbtn:hover { background: var(--bg-3); color: var(--fg-0); }
.iconbtn :deep(svg) { width: 16px; height: 16px; }

.tabs-nav {
  display: flex; gap: 0; padding: 0 12px;
  border-bottom: 1px solid var(--border-0); background: var(--bg-1);
}
.tabs-nav button {
  padding: 10px 16px; font-size: var(--fz-sm);
  color: var(--fg-2); border-bottom: 2px solid transparent;
}
.tabs-nav button.active { color: var(--accent); border-bottom-color: var(--accent); }

.modal-body { padding: 20px 24px; }
.form { display: flex; flex-direction: column; gap: 12px; }
.hint { color: var(--fg-1); font-size: var(--fz-sm); margin: 0 0 4px; }
.hint code { font-family: var(--font-mono); background: var(--bg-2); padding: 1px 4px; border-radius: 3px; }
.file-info {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--bg-1);
  border-radius: var(--radius-md); font-size: var(--fz-sm);
}
.file-info :deep(svg) { color: var(--fg-3); }
.file-info .path { color: var(--fg-3); font-size: var(--fz-xs); margin-left: auto; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field label { font-size: var(--fz-sm); color: var(--fg-1); }
.field input {
  padding: 8px 12px;
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-sm);
  color: var(--fg-0);
  font-size: var(--fz-sm);
}
.field input:focus { outline: none; border-color: var(--accent); }
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
.actions button {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 14px; border-radius: var(--radius-md);
  font-size: var(--fz-sm); background: var(--bg-2);
  color: var(--fg-0); transition: all var(--t-fast);
}
.actions button:hover:not(:disabled) { background: var(--bg-3); }
.actions button.primary { background: var(--accent); color: white; }
.actions button.primary:hover:not(:disabled) { background: var(--accent-hover); }
.actions button:disabled { opacity: 0.4; cursor: not-allowed; }
.actions :deep(svg) { width: 14px; height: 14px; }
.warn { color: var(--warning); font-size: var(--fz-xs); margin: 8px 0 0; }

.vault-state { display: flex; gap: 8px; }
.badge {
  padding: 3px 10px;
  border-radius: 100px;
  font-size: var(--fz-xs);
  border: 1px solid var(--border-0);
}
.badge.on { color: var(--success); border-color: var(--success); }
.badge.off { color: var(--fg-3); }

.status {
  margin-top: 12px; padding: 8px 12px; border-radius: var(--radius-sm);
  font-size: var(--fz-sm);
  white-space: pre-line;
}
.status.ok { background: color-mix(in srgb, var(--success) 15%, transparent); color: var(--success); }
.status.err { background: color-mix(in srgb, var(--danger) 15%, transparent); color: var(--danger); }
.status.info { background: var(--bg-2); color: var(--fg-1); }

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
