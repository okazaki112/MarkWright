<script setup lang="ts">
/**
 * 白噪音浮窗 - 右下角
 * - 4 种环境音：雨/咖啡馆/键盘/森林
 * - 音量滑块
 * - 0 音频资源，Web Audio 程序化合成
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useWhiteNoise, type NoiseType } from '../composables/useWhiteNoise'

const wn = useWhiteNoise()

const visible = computed(() => wn.playing.value)

const TYPES: { id: NoiseType; label: string; icon: string }[] = [
  { id: 'rain',     label: '雨声',     icon: 'lucide:cloud-rain' },
  { id: 'cafe',     label: '咖啡馆',   icon: 'lucide:coffee' },
  { id: 'keyboard', label: '键盘',     icon: 'lucide:keyboard' },
  { id: 'forest',   label: '森林',     icon: 'lucide:tree-pine' },
]

function toggle(t: NoiseType) {
  if (wn.current.value === t) wn.stop()
  else wn.start(t)
}
</script>

<template>
  <transition name="fade">
    <div v-if="visible" class="wn-panel" role="dialog" aria-label="白噪音">
      <div class="header">
        <Icon icon="lucide:volume-2" />
        <span class="title">环境音</span>
        <button class="close" @click="wn.stop()" aria-label="关闭">
          <Icon icon="lucide:x" />
        </button>
      </div>
      <div class="types">
        <button
          v-for="t in TYPES"
          :key="t.id"
          class="tbtn"
          :class="{ active: wn.current.value === t.id }"
          @click="toggle(t.id)"
        >
          <Icon :icon="t.icon" />
          <span>{{ t.label }}</span>
        </button>
      </div>
      <div class="vol">
        <Icon icon="lucide:volume-x" v-if="wn.volume.value === 0" />
        <Icon icon="lucide:volume-1" v-else-if="wn.volume.value < 0.4" />
        <Icon icon="lucide:volume-2" v-else />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="wn.volume.value"
          @input="wn.setVolume(+($event.target as HTMLInputElement).value)"
        />
        <span class="vol-num">{{ Math.round(wn.volume.value * 100) }}%</span>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.wn-panel {
  position: fixed;
  right: 16px;
  bottom: 100px;
  width: 260px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 12px;
  z-index: 90;
}
.header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--fg-0);
}
.header :deep(svg) { width: 16px; height: 16px; color: var(--accent); }
.title { font-weight: 600; font-size: var(--fz-sm); flex: 1; }
.close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px;
  color: var(--fg-3);
}
.close:hover { background: var(--bg-3); color: var(--fg-0); }
.close :deep(svg) { width: 12px; height: 12px; }

.types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 12px;
}
.tbtn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-1);
  color: var(--fg-1);
  font-size: var(--fz-xs);
  transition: all var(--t-fast);
  border: 1px solid transparent;
}
.tbtn:hover { background: var(--bg-3); color: var(--fg-0); }
.tbtn.active {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
  border-color: var(--accent);
}
.tbtn :deep(svg) { width: 13px; height: 13px; }

.vol {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fz-xs);
  color: var(--fg-2);
}
.vol :deep(svg) { width: 14px; height: 14px; flex-shrink: 0; }
.vol input[type='range'] {
  flex: 1;
  accent-color: var(--accent);
}
.vol-num { font-variant-numeric: tabular-nums; min-width: 36px; text-align: right; color: var(--fg-1); }

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
