<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useWorkspaceStore, type FsNode } from '../../stores/workspace'
import { useDocumentStore } from '../../stores/document'
import { useToastStore } from '../../stores/toast'
import { useWorkspaceActions } from '../../composables/useWorkspaceActions'
import { readTextFile } from '@tauri-apps/plugin-fs'
import { FsNodeView } from '../FsNodeView'

const ws = useWorkspaceStore()
const doc = useDocumentStore()
const toasts = useToastStore()
const wsActions = useWorkspaceActions()

/** 上层目录路径，用于信息条副标题 */
const rootDir = computed(() => {
  const p = ws.rootPath
  if (!p) return ''
  const norm = p.replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx > 0 ? norm.slice(0, idx) : norm
})

const creating = ref<{ parent: string; type: 'file' | 'dir' } | null>(null)
const newName = ref('')

function onClickNode(n: FsNode) {
  if (n.isDir) {
    ws.toggle(n)
    return
  }
  openFile(n.path)
}

async function openFile(path: string) {
  try {
    const text = await readTextFile(path)
    doc.loadFromPath(path, text)
  } catch (e) {
    toasts.error('打开失败', String(e))
  }
}

function startCreate(parent: string, type: 'file' | 'dir') {
  creating.value = { parent, type }
  newName.value = ''
}

async function confirmCreate() {
  if (!creating.value || !newName.value.trim()) {
    creating.value = null
    return
  }
  const { parent, type } = creating.value
  const name = newName.value.trim()
  if (type === 'file') {
    const path = await ws.newFile(parent, name.endsWith('.md') ? name : name + '.md')
    if (path) openFile(path)
  } else {
    await ws.newFolder(parent, name)
  }
  creating.value = null
}

function cancelCreate() {
  creating.value = null
}

function onContextMenu(e: MouseEvent, n: FsNode) {
  e.preventDefault()
  if (n.isDir) {
    startCreate(n.path, 'file')
  }
}
</script>

<template>
  <div class="files-tab">
    <div v-if="!ws.rootPath" class="empty">
      <Icon icon="lucide:folder-plus" />
      <p>未打开工作区</p>
      <button class="primary" @click="wsActions.open()">打开文件夹</button>
      <span class="tip">打开后可在顶部随时切换到其他文件夹</span>
    </div>

    <template v-else>
      <!-- 工作区信息条：切换 / 刷新 / 关闭 -->
      <div class="ws-bar">
        <div class="ws-info" :title="ws.rootPath ?? ''">
          <Icon icon="lucide:folder-open" />
          <span class="ws-name">{{ ws.rootName }}</span>
          <span v-if="rootDir" class="ws-dir">{{ rootDir }}</span>
        </div>
        <div class="ws-actions">
          <button class="wbtn" title="切换到其他文件夹" @click="wsActions.switchTo()">
            <Icon icon="lucide:repeat-2" />
          </button>
          <button class="wbtn" title="刷新文件树" @click="wsActions.refresh()">
            <Icon icon="lucide:refresh-cw" />
          </button>
          <button class="wbtn danger" title="关闭工作区" @click="wsActions.close()">
            <Icon icon="lucide:folder-x" />
          </button>
        </div>
      </div>

      <div class="filter-bar">
        <label class="toggle">
          <input
            type="checkbox"
            :checked="ws.showAllFiles"
            @change="ws.setShowAllFiles(($event.target as HTMLInputElement).checked)"
          />
          <span>显示全部文件</span>
        </label>
        <span class="filter-tip">关闭时仅显示可读取的文本文件（md/txt…）</span>
      </div>

      <div v-if="ws.loading" class="loading">加载中…</div>
      <template v-else>
        <div class="row root-row">
          <button class="tnode" @click="startCreate(ws.rootPath!, 'file')">
            <Icon icon="lucide:file-plus" />
            <span>新建文件</span>
          </button>
          <button class="tnode" @click="startCreate(ws.rootPath!, 'dir')">
            <Icon icon="lucide:folder-plus" />
            <span>新建文件夹</span>
          </button>
        </div>

        <ul class="tlist">
          <li v-for="n in ws.tree" :key="n.path">
            <FsNodeView
              :node="n"
              :depth="0"
              @open="onClickNode"
              @create="startCreate"
              @ctx="onContextMenu"
            />
          </li>
        </ul>

        <div v-if="creating" class="create-input">
          <Icon :icon="creating.type === 'file' ? 'lucide:file-plus' : 'lucide:folder-plus'" />
          <input
            v-model="newName"
            @keydown.enter="confirmCreate"
            @keydown.escape="cancelCreate"
            :placeholder="creating.type === 'file' ? '文件名.md' : '文件夹名'"
            autofocus
          />
          <button class="ok" @click="confirmCreate">✓</button>
          <button class="cancel" @click="cancelCreate">✕</button>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.files-tab {
  flex: 1;
  overflow: auto;
  padding: 4px 0 12px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--fg-2);
  padding: 40px 20px;
  height: 100%;
}
.empty :deep(svg) { width: 32px; height: 32px; opacity: 0.5; }
.empty p { margin: 0; font-size: var(--fz-sm); }
.empty .primary {
  padding: 6px 14px;
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--fz-sm);
}
.empty .primary:hover { background: var(--accent-hover); }
.loading { padding: 12px; text-align: center; color: var(--fg-2); font-size: var(--fz-sm); }
.tip { font-size: var(--fz-xs); color: var(--fg-3); }

/* 工作区信息条 */
.ws-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-0);
  flex-shrink: 0;
}
.ws-info {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1;
}
.ws-info :deep(svg) { width: 13px; height: 13px; color: var(--accent); flex-shrink: 0; }
.ws-name {
  font-size: var(--fz-sm);
  font-weight: 600;
  color: var(--fg-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ws-dir {
  font-size: var(--fz-xs);
  color: var(--fg-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl;
  text-align: left;
  min-width: 0;
}
.ws-actions { display: flex; gap: 2px; flex-shrink: 0; }
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--border-0);
  flex-shrink: 0;
}
.filter-bar .toggle { display: flex; align-items: center; gap: 5px; font-size: var(--fz-xs); color: var(--fg-1); cursor: pointer; white-space: nowrap; }
.filter-bar .toggle input { accent-color: var(--accent); width: 14px; height: 14px; }
.filter-bar .filter-tip { font-size: var(--fz-xs); color: var(--fg-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--fg-2);
  transition: background var(--t-fast), color var(--t-fast);
}
.wbtn:hover { background: var(--bg-3); color: var(--fg-0); }
.wbtn.danger:hover { background: rgba(248, 81, 73, 0.15); color: var(--danger); }
.wbtn :deep(svg) { width: 13px; height: 13px; }
.row.root-row { display: flex; gap: 2px; padding: 4px 8px; border-bottom: 1px solid var(--border-0); margin-bottom: 4px; }
.tnode {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  color: var(--fg-2);
  font-size: var(--fz-xs);
  transition: background var(--t-fast), color var(--t-fast);
}
.tnode:hover { background: var(--bg-3); color: var(--fg-0); }
.tnode :deep(svg) { width: 12px; height: 12px; flex-shrink: 0; }
.tlist { list-style: none; margin: 0; padding: 0; }
.create-input {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 6px 10px 0;
  padding: 4px 6px;
  background: var(--bg-2);
  border: 1px solid var(--accent);
  border-radius: 4px;
}
.create-input :deep(svg) { color: var(--accent); width: 12px; height: 12px; }
.create-input input { flex: 1; font-size: var(--fz-sm); color: var(--fg-0); }
.create-input input::placeholder { color: var(--fg-3); }
.create-input button { width: 18px; height: 18px; border-radius: 3px; color: var(--fg-1); }
.create-input button.ok { color: var(--success); }
.create-input button.cancel { color: var(--danger); }
.create-input button:hover { background: var(--bg-3); }
</style>
