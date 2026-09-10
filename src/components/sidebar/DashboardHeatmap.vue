<script setup lang="ts">
/**
 * 近 90 天写作热力图
 * （从 StatsDashboard.vue 拆出，v0.4.8）
 */
import { computed } from 'vue'
import { useStatsStore } from '../../stores/stats'

const stats = useStatsStore()

type Cell = { date: string; words: number; level: 0 | 1 | 2 | 3 | 4 }

const days90 = computed<Cell[]>(() => {
  const map = new Map<string, number>()
  for (const d of stats.dailyStats) map.set(d.date, d.words)
  const out: Cell[] = []
  const today = new Date()
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const w = map.get(key) || 0
    let level: 0 | 1 | 2 | 3 | 4 = 0
    if (w > 0) level = 1
    if (w >= 200) level = 2
    if (w >= 500) level = 3
    if (w >= 1000) level = 4
    out.push({ date: key, words: w, level })
  }
  return out
})

const heatmapWeeks = computed(() => {
  const weeks: Cell[][] = []
  let week: Cell[] = []
  for (const d of days90.value) {
    week.push(d)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  if (week.length > 0) weeks.push(week)
  return weeks
})

const heatmapMonthLabels = computed(() => {
  const out: { col: number; label: string }[] = []
  const weeks = heatmapWeeks.value
  for (let i = 0; i < weeks.length; i++) {
    const first = weeks[i][0]
    const d = new Date(first.date)
    if (d.getDate() <= 7) out.push({ col: i, label: `${d.getMonth() + 1}月` })
  }
  return out
})
</script>

<template>
  <div class="section">
    <h3>近 90 天写作热力图</h3>
    <div class="heatmap">
      <div class="month-labels">
        <span v-for="(m, i) in heatmapMonthLabels" :key="i" :style="{ left: (m.col * 14) + 'px' }">
          {{ m.label }}
        </span>
      </div>
      <div class="grid">
        <div v-for="(week, wi) in heatmapWeeks" :key="wi" class="week">
          <div
            v-for="d in week"
            :key="d.date"
            class="cell"
            :data-level="d.level"
            :title="`${d.date}: ${d.words} 字`"
          />
        </div>
      </div>
      <div class="legend">
        <span>少</span>
        <div class="cell" data-level="0" />
        <div class="cell" data-level="1" />
        <div class="cell" data-level="2" />
        <div class="cell" data-level="3" />
        <div class="cell" data-level="4" />
        <span>多</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section { padding: 0 14px 20px; flex: 1; overflow: auto; }
.section h3 { font-size: var(--fz-md); color: var(--fg-0); margin: 12px 0; }

.heatmap { padding: 0 0 16px; overflow-x: auto; }
.month-labels {
  position: relative;
  height: 18px;
  margin-bottom: 4px;
  font-size: var(--fz-xs);
  color: var(--fg-2);
}
.month-labels span { position: absolute; }
.grid { display: flex; gap: 2px; }
.week { display: flex; flex-direction: column; gap: 2px; }
.cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: var(--bg-2);
}
.cell[data-level='1'] { background: color-mix(in srgb, var(--accent) 25%, var(--bg-2)); }
.cell[data-level='2'] { background: color-mix(in srgb, var(--accent) 50%, var(--bg-2)); }
.cell[data-level='3'] { background: color-mix(in srgb, var(--accent) 75%, var(--bg-2)); }
.cell[data-level='4'] { background: var(--accent); }
.cell:hover { outline: 1px solid var(--accent-hover); }
.legend {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 8px;
  justify-content: flex-end;
  font-size: var(--fz-xs);
  color: var(--fg-2);
}
</style>
