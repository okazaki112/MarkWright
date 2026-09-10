<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useThemeStore, type ThemeMeta } from '../../stores/theme'
import { useFontStore } from '../../stores/font'

const theme = useThemeStore()
const font = useFontStore()

function selectTheme(t: ThemeMeta) {
  theme.setTheme(t.id)
}

/** 预览文字使用当前全局字体（字体已与主题解耦） */
function sampleStyle(): { fontFamily: string } {
  return { fontFamily: font.serif }
}
function decorationLabel(d: string): string {
  return ({ flat: '扁平', paper: '纸张', bar: '色条', card: '卡片' } as Record<string, string>)[d] || d
}
function surfaceLabel(s: string): string {
  return ({ none: '纯色', grid: '网格', paper: '噪点', stars: '星点', lines: '横线', aurora: '极光' } as Record<string, string>)[s] || s
}
function densityLabel(d: string): string {
  return ({ compact: '紧凑', standard: '标准', loose: '宽松' } as Record<string, string>)[d] || d
}
</script>

<template>
  <section class="themes-grid">
    <article
      v-for="t in theme.themes"
      :key="t.id"
      class="theme-card"
      :class="{ active: t.id === theme.currentId }"
      @click="selectTheme(t)"
    >
      <div class="swatches">
        <div
          v-for="s in t.swatch"
          :key="s.name"
          class="swatch"
          :style="{ background: s.color }"
          :title="s.name"
        />
      </div>
      <div class="theme-info">
        <div class="theme-name">
          {{ t.name }}
          <Icon v-if="t.id === theme.currentId" icon="lucide:check-circle-2" class="check" />
        </div>
        <div class="theme-desc">{{ t.description }}</div>
        <div class="theme-author">by {{ t.author }}</div>
        <div class="theme-sample" :style="sampleStyle()">Aa 静夜思</div>
        <div class="theme-tags">
          <span class="tag">{{ decorationLabel(t.decoration) }}</span>
          <span class="tag">{{ surfaceLabel(t.surface) }}</span>
          <span class="tag">{{ densityLabel(t.density) }}</span>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.themes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.theme-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--t-fast);
}
.theme-card:hover { border-color: var(--border-1); }
.theme-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}
.swatches {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.swatch { width: 100%; height: 100%; }
.theme-info { flex: 1; min-width: 0; }
.theme-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fz-md);
  font-weight: 600;
  color: var(--fg-0);
  margin-bottom: 4px;
}
.theme-name .check { color: var(--success); width: 14px; height: 14px; }
.theme-desc { font-size: var(--fz-xs); color: var(--fg-1); margin-bottom: 2px; }
.theme-author { font-size: var(--fz-xs); color: var(--fg-3); margin-bottom: 6px; }
.theme-sample {
  font-size: 18px;
  font-weight: 600;
  color: var(--fg-0);
  padding: 6px 8px;
  background: var(--bg-2);
  border-radius: 4px;
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}
.theme-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.tag {
  display: inline-block;
  padding: 1px 8px;
  font-size: 10px;
  background: var(--bg-2);
  border: 1px solid var(--border-0);
  border-radius: 10px;
  color: var(--fg-2);
}
</style>
