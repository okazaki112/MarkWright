<script setup lang="ts">
/**
 * LinksPanel - 反向链接 + 标签云
 */
import { computed, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { useLinksStore } from '../stores/links'
import { useDocumentStore } from '../stores/document'
import { useWorkspaceStore } from '../stores/workspace'
import { useToastStore } from '../stores/toast'
import { readTextFile } from '@tauri-apps/plugin-fs'

const links = useLinksStore()
const doc = useDocumentStore()
const ws = useWorkspaceStore()
const toasts = useToastStore()

onMounted(() => {
  if (ws.rootPath) links.scanWorkspace()
})

watch(
  () => ws.tree.length,
  () => { if (ws.rootPath) links.scanWorkspace() }
)

const currentFileName = computed(() => {
  const t = doc.activeTab
  if (!t) return ''
  return t.name.replace(/\.md$/i, '')
})

const currentBacklinks = computed(() => {
  if (!currentFileName.value) return []
  return links.getBacklinks(currentFileName.value)
})

const tagList = computed(() => links.tagList())

async function openFile(path: string) {
  try {
    const text = await readTextFile(path)
    doc.loadFromPath(path, text)
  } catch (e) {
    toasts.error('打开失败', String(e))
  }
}
</script>

<template>
  <div class="links">
    <div v-if="!ws.rootPath" class="empty">
      <Icon icon="lucide:link" />
      <p>请先在文件 tab 打开工作区</p>
    </div>
    <template v-else>
      <section class="section">
        <h4 class="title">
          <Icon icon="lucide:link-2" />
          反向链接
          <span v-if="currentFileName" class="hint">被引用</span>
        </h4>
        <div v-if="links.scanning" class="scanning">扫描中…</div>
        <div v-else-if="!currentFileName" class="empty-mini">当前无文件</div>
        <div v-else-if="currentBacklinks.length === 0" class="empty-mini">
          暂无文件引用 <code>[[{{ currentFileName }}]]</code>
        </div>
        <ul v-else class="backlinks">
          <li v-for="b in currentBacklinks" :key="b.fromPath" @click="openFile(b.fromPath)">
            <Icon icon="lucide:file-text" />
            <span>{{ b.fromName }}</span>
          </li>
        </ul>
      </section>

      <section class="section">
        <h4 class="title">
          <Icon icon="lucide:hash" />
          标签云
          <span class="hint">{{ tagList.length }} 个</span>
        </h4>
        <div v-if="links.scanning" class="scanning">扫描中…</div>
        <div v-else-if="tagList.length === 0" class="empty-mini">暂无标签</div>
        <div v-else class="tag-cloud">
          <span
            v-for="t in tagList"
            :key="t.name"
            class="tag-chip"
            :style="{ fontSize: 10 + Math.min(8, t.count) + 'px', opacity: 0.6 + Math.min(0.4, t.count * 0.05) }"
          >
            #{{ t.name }}<span class="cnt">{{ t.count }}</span>
          </span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.links {
  flex: 1;
  overflow: auto;
  padding: 8px 0 16px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--fg-2);
  gap: 8px;
}
.empty :deep(svg) { width: 32px; height: 32px; opacity: 0.4; }
.empty p { margin: 0; font-size: var(--fz-sm); }
.empty-mini {
  padding: 12px 14px;
  color: var(--fg-3);
  font-size: var(--fz-xs);
}
.empty-mini code {
  font-family: var(--font-mono);
  background: var(--bg-2);
  padding: 1px 4px;
  border-radius: 3px;
}
.scanning { padding: 12px 14px; color: var(--fg-2); font-size: var(--fz-sm); }

.section { margin-bottom: 16px; }
.title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fz-xs);
  color: var(--fg-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  padding: 0 14px 6px;
}
.title :deep(svg) { width: 12px; height: 12px; }
.title .hint { margin-left: auto; color: var(--fg-3); font-weight: 400; text-transform: none; }

.backlinks { list-style: none; margin: 0; padding: 0; }
.backlinks li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  font-size: var(--fz-sm);
  color: var(--fg-1);
  cursor: pointer;
  transition: background var(--t-fast);
}
.backlinks li:hover { background: var(--bg-3); color: var(--fg-0); }
.backlinks li :deep(svg) { width: 12px; height: 12px; color: var(--fg-3); }

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 14px;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border-radius: 3px;
  cursor: default;
  transition: all var(--t-fast);
}
.tag-chip:hover {
  background: color-mix(in srgb, var(--success) 20%, transparent);
}
.tag-chip .cnt {
  font-size: 9px;
  color: var(--fg-3);
  margin-left: 2px;
}
</style>
