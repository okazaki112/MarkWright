<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useThemeStore } from '../stores/theme'
import ThemeTab from './settings/ThemeTab.vue'
import EditorTab from './settings/EditorTab.vue'
import FontTab from './settings/FontTab.vue'
import AboutTab from './settings/AboutTab.vue'

const theme = useThemeStore()
const tab = ref<'themes' | 'editor' | 'font' | 'about'>('themes')

function close() {
  theme.closeSettings()
}
</script>

<template>
  <transition name="fade">
    <div v-if="theme.settingsOpen" class="overlay" @click.self="close">
      <div class="modal" role="dialog" aria-label="偏好设置">
        <header class="modal-header">
          <h2>偏好设置</h2>
          <button class="iconbtn" @click="close" aria-label="关闭">
            <Icon icon="lucide:x" />
          </button>
        </header>

        <nav class="tabs-nav">
          <button :class="{ active: tab === 'themes' }" @click="tab = 'themes'">主题</button>
          <button :class="{ active: tab === 'editor' }" @click="tab = 'editor'">编辑器</button>
          <button :class="{ active: tab === 'font' }" @click="tab = 'font'">字体</button>
          <button :class="{ active: tab === 'about' }" @click="tab = 'about'">关于</button>
        </nav>

        <main class="modal-body">
          <ThemeTab v-if="tab === 'themes'" />
          <EditorTab v-else-if="tab === 'editor'" />
          <FontTab v-else-if="tab === 'font'" />
          <AboutTab v-else />
        </main>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(2px);
}
.modal {
  width: 720px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-0);
}
.modal-header h2 { margin: 0; font-size: var(--fz-lg); font-weight: 600; }
.iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--fg-2);
  transition: background var(--t-fast);
}
.iconbtn:hover { background: var(--bg-3); color: var(--fg-0); }
.iconbtn :deep(svg) { width: 16px; height: 16px; }

.tabs-nav {
  display: flex;
  gap: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--border-0);
  background: var(--bg-1);
}
.tabs-nav button {
  padding: 10px 16px;
  font-size: var(--fz-sm);
  color: var(--fg-2);
  border-bottom: 2px solid transparent;
  transition: color var(--t-fast), border-color var(--t-fast);
}
.tabs-nav button:hover { color: var(--fg-0); }
.tabs-nav button.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.modal-body {
  flex: 1;
  overflow: auto;
  padding: 20px 24px;
}

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
