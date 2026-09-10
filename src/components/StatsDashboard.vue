<script setup lang="ts">
/**
 * 写作统计仪表盘（外壳）
 * v0.4.8：拆分为 DashboardOverview / DashboardHeatmap / DashboardGoals 三个子组件，
 * 本文件只负责初始化、tab 切换与底部导航
 */
import { computed, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import { useStatsStore } from '../stores/stats'
import DashboardOverview from './sidebar/DashboardOverview.vue'
import DashboardHeatmap from './sidebar/DashboardHeatmap.vue'
import DashboardGoals from './sidebar/DashboardGoals.vue'

const stats = useStatsStore()
const tab = ref<'overview' | 'heatmap' | 'settings'>('overview')

onMounted(() => {
  if (stats.initialized) stats.refresh()
  else stats.init()
})

const trend30 = computed(() => {
  const map = new Map<string, number>()
  for (const d of stats.dailyStats) map.set(d.date, d.words)
  const out: { date: string; words: number }[] = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    out.push({ date: key, words: map.get(key) || 0 })
  }
  return out
})

const maxTrend = computed(() => Math.max(1, ...trend30.value.map((d) => d.words)))
</script>

<template>
  <transition name="fade">
    <div v-if="stats.initialized" class="dashboard-host">
      <!-- v-if 而非 v-show：不在当前 tab 的面板完全不创建实例 -->
      <DashboardOverview v-if="tab === 'overview'" :trend="trend30" :max-trend="maxTrend" />
      <DashboardHeatmap v-else-if="tab === 'heatmap'" />
      <DashboardGoals v-else />

      <nav class="tabs">
        <button :class="{ active: tab === 'overview' }" @click="tab = 'overview'">
          <Icon icon="lucide:layout-dashboard" /><span>概览</span>
        </button>
        <button :class="{ active: tab === 'heatmap' }" @click="tab = 'heatmap'">
          <Icon icon="lucide:flame" /><span>热力图</span>
        </button>
        <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">
          <Icon icon="lucide:target" /><span>目标</span>
        </button>
      </nav>
    </div>
  </transition>
</template>

<style scoped>
.dashboard-host {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

/* 底部 tab 导航 */
.tabs {
  display: flex;
  border-top: 1px solid var(--border-0);
  background: var(--bg-1);
  flex-shrink: 0;
}
.tabs button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  font-size: var(--fz-sm);
  color: var(--fg-2);
  border-bottom: 2px solid transparent;
  transition: all var(--t-fast);
}
.tabs button:hover { color: var(--fg-0); }
.tabs button.active { color: var(--accent); border-bottom-color: var(--accent); }
.tabs :deep(svg) { width: 14px; height: 14px; }

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
