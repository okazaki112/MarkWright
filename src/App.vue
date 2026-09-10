<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { EditorView } from '@codemirror/view'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

import TitleBar from './components/TitleBar.vue'
import ToolBar from './components/ToolBar.vue'
import TabBar from './components/TabBar.vue'
import Sidebar from './components/Sidebar.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import StatusBar from './components/StatusBar.vue'
import ShortcutHint from './components/ShortcutHint.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import CommandPalette from './components/CommandPalette.vue'
import QuickOpenPanel from './components/QuickOpenPanel.vue'
import JumpLinePanel from './components/JumpLinePanel.vue'
import GlobalSearchPanel from './components/GlobalSearchPanel.vue'
import FocusOverlay from './components/FocusOverlay.vue'
import VaultDialog from './components/VaultDialog.vue'
import VaultUnlockDialog from './components/VaultUnlockDialog.vue'
import ToastHost from './components/ToastHost.vue'
import TemplatePanel from './components/TemplatePanel.vue'
import WhiteNoisePanel from './components/WhiteNoisePanel.vue'

import { useDocumentStore } from './stores/document'
import { useUIStore } from './stores/ui'
import { useStatsStore } from './stores/stats'
import { useSessionStore } from './stores/session'
import { useToastStore } from './stores/toast'
import { useFontStore } from './stores/font'
import { useScrollSync } from './composables/useScrollSync'
import { useAutoSave } from './composables/useAutoSave'
import { useCommands } from './composables/useCommands'
import { editorActions, type EditorActions } from './composables/useEditorActions'
import { useWhiteNoise } from './composables/useWhiteNoise'
import { useVault } from './composables/useVault'

const doc = useDocumentStore()
const ui = useUIStore()
const stats = useStatsStore()
const session = useSessionStore()
const toasts = useToastStore()
useFontStore() // 初始化并应用全局字体（已与主题解耦）
const whiteNoise = useWhiteNoise()
const vault = useVault()

useAutoSave()
useCommands()

// 启动时初始化统计 & 字数追踪
stats.init()
stats.startTracking()

// 监听 doc.activeTab.content 增量
watch(
  () => doc.activeTab?.content,
  () => stats.trackChange()
)
// 切换 tab 重新锚定 lastWords
watch(
  () => doc.activeId,
  () => stats.trackSwitch()
)

// Vault 弹层
const vaultOpen = ref(false)
function onVaultOpen() { vaultOpen.value = true }

// Kanban 改动同步回原文
function onKanbanChange(e: Event) {
  const detail = (e as CustomEvent).detail
  if (!doc.activeTab) return
  // 在 content 中找到原始块并替换
  // 简化：先找到 # 注释块 marker，实际更复杂，这里只提示用户手动同步
  if (doc.activeTab.content.includes(detail.original)) {
    doc.setContent(doc.activeTab.content.replace(detail.original, detail.next))
  } else {
    toasts.warn('Kanban 已修改', '请手动更新源 markdown（原始块已变）')
  }
}
onMounted(() => {
  window.addEventListener('markwright:open-vault', onVaultOpen)
  window.addEventListener('markwright:kanban-change', onKanbanChange)
  // 同步「工作区加密是否已启用」，供保存时决定是否落盘密文
  void vault.refreshEnabled()
})
onBeforeUnmount(() => {
  window.removeEventListener('markwright:open-vault', onVaultOpen)
  window.removeEventListener('markwright:kanban-change', onKanbanChange)
  // v0.4.8：先把挂起的字数增量落库，再释放全部定时器
  stats.flushTracking()
  session.stopAutoSave()
  session.dispose()
  session.save()
  whiteNoise.dispose()
})

const editorRef = ref<InstanceType<typeof EditorPane> | null>(null)
const previewRef = ref<InstanceType<typeof PreviewPane> | null>(null)

const editorView = ref<EditorView | null>(null) as { value: EditorView | null }
const actions = ref<EditorActions | null>(null)
const fallbackActions: EditorActions = editorActions(null)
const safeActions = computed<EditorActions>(() => actions.value ?? fallbackActions)

function onEditorReady(view: EditorView, a: EditorActions) {
  editorView.value = view
  actions.value = a
  setupSync()
}

let detachSync: (() => void) | null = null
function setupSync() {
  detachSync?.()
  const sync = useScrollSync({
    getEditor: () => editorView.value,
    getPreview: () => previewRef.value?.getPane() ?? null,
    enabled: () => ui.scrollSync && ui.viewMode === 'split',
  })
  sync.attach()
  detachSync = () => sync.detach()
}

watch(() => [ui.scrollSync, ui.viewMode], () => setupSync())
watch(() => doc.activeId, () => setTimeout(setupSync, 30))

// 分隔条拖拽
const splitterDragging = ref(false)
function startDrag(e: MouseEvent) {
  splitterDragging.value = true
  e.preventDefault()
  document.body.style.cursor = 'col-resize'
}
function onMove(e: MouseEvent) {
  if (!splitterDragging.value) return
  const container = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (e.clientX - container.left) / container.width
  ui.setSplitRatio(ratio)
}
function stopDrag() {
  if (!splitterDragging.value) return
  splitterDragging.value = false
  document.body.style.cursor = ''
}

/** 文件关联打开：加载路径指定的 Markdown 文件为新标签（并移除残留的欢迎页） */
async function openFileFromPath(path: string) {
  try {
    // 走 Vault 读取：自动识别 MWV1 密文并弹出主密码框；明文则用 Rust 直读（不受 fs scope 限制）
    const text = await vault.readDocument(path, (p) =>
      invoke<string>('read_opened_file', { path: p }),
    )
    // 若当前只有未改动的默认欢迎页，先移除，避免与打开的文件并存
    doc.closeDefaultWelcomeIfAlone()
    doc.loadFromPath(path, text)
  } catch (e) {
    if (String(e).includes('已取消')) return
    toasts.error('打开文件失败', path)
  }
}

onMounted(async () => {
  window.addEventListener('mousemove', onMove as any)
  window.addEventListener('mouseup', stopDrag)
  setupCloseGuard()

  // 1) 先注册「程序已运行时」单实例回调发来的 open-file 监听（整个生命周期有效）
  try {
    await listen<string>('open-file', (e) => {
      const p = e.payload
      if (p) openFileFromPath(p)
    })
  } catch { /* 浏览器预览 */ }

  // 2) 再恢复 UI 状态（不再恢复历史标签页，避免旧文档残留、抢占关联打开的文件）
  await session.restore()

  // 3) 最后打开本次双击关联的 .md 文件 —— 必定显示并激活，不被旧页面覆盖
  try {
    const pending = await invoke<string | null>('take_pending_file')
    if (pending) openFileFromPath(pending)
  } catch { /* 浏览器预览 */ }

  session.startAutoSave()
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onMove as any)
  window.removeEventListener('mouseup', stopDrag)
  detachSync?.()
})

async function setupCloseGuard() {
  try {
    const win = getCurrentWindow()
    const { ask } = await import('@tauri-apps/plugin-dialog')
    await win.onCloseRequested(async (event) => {
      // 一律先拦截，由本函数决定何时销毁窗口；
      // 避免 preventDefault 后任何一步抛错导致窗口「关不掉」
      event.preventDefault()
      try {
        const dirtyTabs = doc.tabs.filter((t) => t.content !== t.savedContent)
        if (dirtyTabs.length === 0) return
        const choice = await ask(
          `有 ${dirtyTabs.length} 个文档未保存，是否保存？`,
          {
            title: '未保存的修改',
            kind: 'warning',
            okLabel: '保存',
            cancelLabel: '放弃',
          }
        )
        if (choice) {
          for (const t of dirtyTabs) {
            if (t.path) {
              try {
                // 静默写入：启用加密则落盘密文；未解锁则跳过（退出流程不弹密码框）
                const ok = await vault.writeDocumentQuiet(t.path, t.content)
                if (!ok) continue
                t.savedContent = t.content
                t.lastSavedAt = Date.now()
              } catch {
                /* 忽略 */
              }
            }
          }
        }
      } finally {
        // 无论成功、取消还是中途抛错，都必须关闭窗口
        try { await win.destroy() } catch { /* 已销毁则忽略 */ }
      }
    })
  } catch {
    /* 浏览器预览 */
  }
}
</script>

<template>
  <div class="app-root" :class="{ 'focus-mode': ui.focusMode }">
    <TitleBar v-if="!ui.focusMode" />
    <TabBar v-if="!ui.focusMode" />
    <div class="main-row">
      <Sidebar v-if="!ui.focusMode" v-show="ui.sidebarOpen" />
      <div class="center-col">
        <ToolBar v-if="!ui.focusMode" :actions="safeActions" />
        <main class="workarea">
          <div v-if="ui.viewMode === 'editor'" class="pane editor-only">
            <EditorPane ref="editorRef" @ready="onEditorReady" />
          </div>
          <div v-else-if="ui.viewMode === 'preview'" class="pane preview-only">
            <PreviewPane ref="previewRef" />
          </div>
          <div v-else class="split">
            <div class="pane" :style="{ width: `calc(${ui.splitRatio * 100}% - 2px)` }">
              <EditorPane ref="editorRef" @ready="onEditorReady" />
            </div>
            <div
              class="splitter"
              :class="{ dragging: splitterDragging }"
              @mousedown="startDrag"
            />
            <div class="pane" :style="{ width: `calc(${(1 - ui.splitRatio) * 100}% - 2px)` }">
              <PreviewPane ref="previewRef" />
            </div>
          </div>
        </main>
        <StatusBar v-if="!ui.focusMode" />
      </div>
    </div>
    <ShortcutHint />
    <SettingsPanel />
    <CommandPalette />
    <QuickOpenPanel />
    <JumpLinePanel />
    <GlobalSearchPanel />
    <FocusOverlay />
    <VaultDialog :open="vaultOpen" @close="vaultOpen = false" />
    <VaultUnlockDialog />
    <TemplatePanel />
    <WhiteNoisePanel />
    <ToastHost />
  </div>
</template>

<style scoped>
.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-0);
  color: var(--fg-0);
  position: relative;
}

.main-row {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.center-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workarea {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
  position: relative;
}

.pane {
  height: 100%;
  overflow: hidden;
  background: var(--bg-0);
  position: relative;
}
.split { display: flex; width: 100%; height: 100%; }
.splitter {
  width: var(--splitter-w);
  cursor: col-resize;
  background: var(--border-0);
  flex-shrink: 0;
  transition: background var(--t-fast);
}
.splitter:hover, .splitter.dragging { background: var(--accent); }
.editor-only, .preview-only { width: 100%; }

/* 专注模式：外壳已隐藏，编辑区居中收窄，留出呼吸感 */
.app-root.focus-mode .workarea {
  max-width: 1080px;
  width: 100%;
  margin: 0 auto;
  padding: 28px 0 12px;
}
.app-root.focus-mode .pane {
  background: transparent;
}
</style>
