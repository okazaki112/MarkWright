<script setup lang="ts">
/**
 * 阅读分析面板 - 阅读时长 + Flesch 易读性
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { readingTime, fleschChinese, fleschEnglish } from '../composables/useReadability'
import { useDocumentStore } from '../stores/document'

const doc = useDocumentStore()
const text = computed(() => doc.activeTab?.content ?? '')

const stats = computed(() => readingTime(text.value))
const cn = computed(() => fleschChinese(text.value))
const en = computed(() => fleschEnglish(text.value))

// 综合（按字数比例混合）
const combined = computed(() => {
  const s = stats.value
  if (s.cjk === 0) return en.value
  if (s.ascii === 0) return cn.value
  const cnWeight = s.cjk / s.words
  const enWeight = s.ascii / s.words
  const score = cn.value.score * cnWeight + en.value.score * enWeight
  return { score: Math.round(score), level: cn.value.level }
})

function scoreColor(score: number): string {
  if (score >= 70) return 'var(--success)'
  if (score >= 50) return 'var(--warning)'
  return 'var(--danger)'
}
</script>

<template>
  <div class="readability">
    <section class="section">
      <h4 class="title">
        <Icon icon="lucide:clock" />
        阅读时长
      </h4>
      <div class="big">{{ stats.minutes }}<span class="of">分钟</span></div>
      <div class="meta">
        <div><span class="num">{{ stats.cjk }}</span> 中文字</div>
        <div><span class="num">{{ stats.ascii }}</span> 英文词</div>
        <div><span class="num">{{ stats.sentences }}</span> 句</div>
        <div><span class="num">{{ stats.paragraphs }}</span> 段</div>
      </div>
    </section>

    <section class="section">
      <h4 class="title">
        <Icon icon="lucide:bar-chart-3" />
        易读性评分
      </h4>
      <div class="big" :style="{ color: scoreColor(combined.score) }">
        {{ combined.score }}<span class="of">/100</span>
      </div>
      <div class="level">{{ combined.level }}</div>
      <div class="gauge">
        <div class="gauge-fill" :style="{
          width: combined.score + '%',
          background: scoreColor(combined.score)
        }" />
      </div>
      <div class="split" v-if="stats.cjk > 0 && stats.ascii > 0">
        <div class="split-item">
          <div class="split-label">中文</div>
          <div class="split-num" :style="{ color: scoreColor(cn.score) }">{{ cn.score }}</div>
          <div class="split-lv">{{ cn.level }}</div>
        </div>
        <div class="split-item">
          <div class="split-label">英文</div>
          <div class="split-num" :style="{ color: scoreColor(en.score) }">{{ en.score }}</div>
          <div class="split-lv">{{ en.level }}</div>
        </div>
      </div>
      <div class="hint">
        评分基于 Flesch Reading Ease 简化模型
      </div>
    </section>
  </div>
</template>

<style scoped>
.readability {
  padding: 8px 14px 16px;
  flex: 1;
  overflow: auto;
}
.section { margin-bottom: 20px; }
.title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--fz-xs);
  color: var(--fg-2);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
  margin-bottom: 8px;
}
.title :deep(svg) { width: 12px; height: 12px; }
.big {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--fg-0);
}
.big .of { font-size: 14px; color: var(--fg-3); margin-left: 4px; font-weight: 400; }
.level {
  font-size: var(--fz-sm);
  color: var(--fg-1);
  margin-top: 4px;
}
.gauge {
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 8px;
}
.gauge-fill { height: 100%; transition: all var(--t-slow); border-radius: 3px; }
.meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 12px;
  margin-top: 8px;
  font-size: var(--fz-xs);
  color: var(--fg-2);
}
.meta .num { color: var(--fg-0); font-weight: 600; font-variant-numeric: tabular-nums; margin-right: 3px; }
.split {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.split-item {
  flex: 1;
  padding: 8px;
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: 4px;
  text-align: center;
}
.split-label { font-size: var(--fz-xs); color: var(--fg-3); }
.split-num { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 2px; }
.split-lv { font-size: 10px; color: var(--fg-2); margin-top: 2px; }
.hint {
  margin-top: 12px;
  font-size: var(--fz-xs);
  color: var(--fg-3);
  font-style: italic;
}
</style>
