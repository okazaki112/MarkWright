<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { exportHtml, exportPdf, copyHtmlToClipboard } from '../composables/useExport'
import { exportPng } from '../composables/useExportPng'

const open = ref(false)
const status = ref<string>('')

function toggle() {
  open.value = !open.value
}

async function doHtml() {
  status.value = '导出中…'
  const ok = await exportHtml()
  status.value = ok ? '✓ HTML 已导出' : '✕ 失败'
  setTimeout(() => { status.value = ''; open.value = false }, 1500)
}
async function doPng() {
  status.value = '渲染图片中…'
  const ok = await exportPng()
  status.value = ok ? '✓ PNG 已导出' : '✕ 失败'
  setTimeout(() => { status.value = ''; open.value = false }, 1500)
}
function doPdf() {
  status.value = '打开打印窗口…'
  exportPdf()
  setTimeout(() => { status.value = ''; open.value = false }, 1500)
}
async function doCopy() {
  status.value = '复制中…'
  const ok = await copyHtmlToClipboard()
  status.value = ok ? '✓ 富文本已复制' : '✕ 失败'
  setTimeout(() => { status.value = ''; open.value = false }, 1500)
}

function onBlur(e: FocusEvent) {
  // 关闭菜单（点击菜单项不触发，因为按钮在内部）
  const next = e.relatedTarget as HTMLElement | null
  if (next && (next as HTMLElement).closest('.export-menu')) return
  setTimeout(() => { open.value = false }, 120)
}
</script>

<template>
  <div class="export-menu" @focusout="onBlur" tabindex="-1">
    <button class="menu-btn" @click="toggle" :class="{ open }">
      <Icon icon="lucide:download" />
      <span>导出</span>
      <Icon icon="lucide:chevron-down" class="caret" />
    </button>
    <transition name="dropdown">
      <div v-if="open" class="dropdown">
        <button class="item" @click="doPdf">
          <Icon icon="lucide:file-text" />
          <div class="text">
            <div class="title">导出为 PDF</div>
            <div class="desc">通过打印对话框保存为 PDF</div>
          </div>
        </button>
        <button class="item" @click="doHtml">
          <Icon icon="lucide:code" />
          <div class="text">
            <div class="title">导出为 HTML</div>
            <div class="desc">独立 HTML 文件，可双击查看</div>
          </div>
        </button>
        <button class="item" @click="doCopy">
          <Icon icon="lucide:clipboard-copy" />
          <div class="text">
            <div class="title">复制富文本</div>
            <div class="desc">复制为 HTML 到剪贴板</div>
          </div>
        </button>
        <button class="item" @click="doPng">
          <Icon icon="lucide:image" />
          <div class="text">
            <div class="title">导出为 PNG</div>
            <div class="desc">将文档渲染为一张图片</div>
          </div>
        </button>
        <div v-if="status" class="status">{{ status }}</div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.export-menu { position: relative; }

.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  color: var(--fg-1);
  font-size: var(--fz-sm);
  transition: background var(--t-fast), color var(--t-fast);
}
.menu-btn:hover, .menu-btn.open {
  background: var(--bg-3);
  color: var(--fg-0);
}
.menu-btn :deep(svg) { width: 14px; height: 14px; }
.menu-btn .caret { width: 10px !important; height: 10px !important; opacity: 0.7; }

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 240px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: 4px;
  z-index: 50;
}
.item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 4px;
  color: var(--fg-0);
  font-size: var(--fz-sm);
  text-align: left;
  transition: background var(--t-fast);
}
.item:hover { background: var(--bg-3); }
.item :deep(svg) { width: 16px; height: 16px; color: var(--accent); flex-shrink: 0; margin-top: 2px; }
.text { flex: 1; }
.title { color: var(--fg-0); font-weight: 500; }
.desc { color: var(--fg-2); font-size: var(--fz-xs); margin-top: 2px; }

.status {
  padding: 6px 10px;
  font-size: var(--fz-xs);
  color: var(--fg-1);
  text-align: center;
  border-top: 1px solid var(--border-0);
  margin-top: 4px;
}

.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity var(--t-fast), transform var(--t-fast);
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
