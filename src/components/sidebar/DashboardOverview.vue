<script setup lang="ts">
/**
 * 统计概览：今日 / 本周 / 总计 + 近 30 天趋势
 * （从 StatsDashboard.vue 拆出，v0.4.8）
 */
import { computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useStatsStore } from '../../stores/stats'

const props = defineProps<{
  trend: { date: string; words: number }[]
  maxTrend: number
}>()

const stats = useStatsStore()

const todayProgress = computed(() =>
  Math.min(100, (stats.summary.today.words / stats.dailyGoal) * 100)
)

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
</script>

<template>
  <div class="dashboard">
    <div class="cards">
      <div class="card hero">
        <div class="card-title">今日</div>
        <div class="big-num">{{ stats.summary.today.words }}<span class="of">/{{ stats.dailyGoal }}</span></div>
        <div class="card-sub">字数</div>
        <div class="bar"><div class="fill" :style="{ width: todayProgress + '%' }" /></div>
        <div class="extra">
          <div><Icon icon="lucide:flame" /> {{ stats.summary.today.pomodoros }} 番茄</div>
          <div><Icon icon="lucide:clock" /> {{ formatDuration(stats.summary.today.duration) }}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">本周</div>
        <div class="big-num">{{ stats.summary.week.words }}</div>
        <div class="card-sub">字数</div>
        <div class="extra">
          <div><Icon icon="lucide:flame" /> {{ stats.summary.week.pomodoros }} 番茄</div>
          <div><Icon icon="lucide:clock" /> {{ formatDuration(stats.summary.week.duration) }}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">总计</div>
        <div class="big-num">{{ stats.summary.total.words }}</div>
        <div class="card-sub">字数</div>
        <div class="extra">
          <div><Icon icon="lucide:flame" /> {{ stats.summary.total.pomodoros }} 番茄</div>
          <div><Icon icon="lucide:clock" /> {{ formatDuration(stats.summary.total.duration) }}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>近 30 天字数</h3>
      <div class="trend">
        <div class="bars">
          <div
            v-for="d in props.trend"
            :key="d.date"
            class="bar-col"
            :title="`${d.date}: ${d.words} 字`"
          >
            <div class="bar-fill" :style="{ height: (d.words / props.maxTrend * 100) + '%' }" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  flex: 1;
  overflow: auto;
  padding: 12px 14px;
}
.section { padding: 0 14px; }
.section h3 { font-size: var(--fz-md); color: var(--fg-0); margin: 12px 0; }

/* 窄侧边栏自动降为 1~2 列，不再挤压数字 */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(124px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}
.card {
  padding: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  min-width: 0;
}
.card.hero { border-color: var(--accent); }
.card-title { font-size: var(--fz-xs); color: var(--fg-2); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
.big-num {
  font-size: 28px;
  font-weight: 700;
  color: var(--fg-0);
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
  overflow-wrap: anywhere;
}
.big-num .of { font-size: 14px; color: var(--fg-3); margin-left: 2px; font-weight: 400; }
.card-sub { font-size: var(--fz-xs); color: var(--fg-2); margin-bottom: 8px; }
.bar {
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.bar .fill {
  height: 100%;
  background: var(--accent);
  transition: width var(--t-slow);
}
.extra {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 10px;
  font-size: var(--fz-xs);
  color: var(--fg-2);
}
.extra :deep(svg) { width: 11px; height: 11px; vertical-align: -2px; margin-right: 2px; }

.trend { height: 140px; padding: 0 4px; }
.bars { display: flex; align-items: flex-end; gap: 2px; height: 100%; }
.bar-col { flex: 1; height: 100%; display: flex; align-items: flex-end; cursor: default; }
.bar-fill {
  width: 100%;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
  min-height: 1px;
  transition: height var(--t-base);
  opacity: 0.85;
}
.bar-col:hover .bar-fill { opacity: 1; }
</style>
