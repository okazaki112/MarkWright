<script setup lang="ts">
/**
 * 写作目标 + 番茄钟进度
 * （从 StatsDashboard.vue 拆出，v0.4.8）
 */
import { computed, ref, watch } from 'vue'
import { useStatsStore } from '../../stores/stats'

const stats = useStatsStore()

const goalInput = ref<number>(stats.dailyGoal)
const pomoInput = ref<number>(stats.pomodoroGoal)

// 外部（如 Rust 设置）改了目标时同步回输入框
watch(() => stats.dailyGoal, (v) => (goalInput.value = v))
watch(() => stats.pomodoroGoal, (v) => (pomoInput.value = v))

const pomoProgress = computed(() =>
  Math.min(100, (stats.summary.today.pomodoros / stats.pomodoroGoal) * 100)
)

function applyGoals() {
  const g = Math.max(0, Math.round(goalInput.value) || 0)
  const p = Math.min(20, Math.max(0, Math.round(pomoInput.value) || 0))
  goalInput.value = g
  pomoInput.value = p
  stats.setDailyGoal(g)
  stats.setPomodoroGoal(p)
}
</script>

<template>
  <div class="section">
    <h3>写作目标</h3>
    <div class="goals">
      <div class="goal-row">
        <label>每日字数目标</label>
        <input type="number" v-model.number="goalInput" min="0" step="100" />
        <span class="hint">当前 {{ stats.dailyGoal }}</span>
      </div>
      <div class="goal-row">
        <label>每日番茄目标</label>
        <input type="number" v-model.number="pomoInput" min="0" max="20" />
        <span class="hint">当前 {{ stats.pomodoroGoal }}</span>
      </div>
      <button class="apply" @click="applyGoals">应用</button>
    </div>
    <h3>番茄钟今日进度</h3>
    <div class="bar big">
      <div class="fill success" :style="{ width: pomoProgress + '%' }" />
      <div class="bar-text">{{ stats.summary.today.pomodoros }} / {{ stats.pomodoroGoal }}</div>
    </div>
  </div>
</template>

<style scoped>
.section { padding: 0 14px 20px; flex: 1; overflow: auto; }
.section h3 { font-size: var(--fz-md); color: var(--fg-0); margin: 12px 0; }

.goals { display: flex; flex-direction: column; gap: 12px; }
.goal-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; }
.goal-row label { flex: 1; color: var(--fg-1); font-size: var(--fz-sm); }
.goal-row input {
  width: 100px;
  padding: 6px 10px;
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-sm);
  color: var(--fg-0);
  font-size: var(--fz-sm);
}
.goal-row .hint { color: var(--fg-3); font-size: var(--fz-xs); }
.apply {
  align-self: flex-start;
  padding: 6px 16px;
  background: var(--accent);
  color: white;
  border-radius: var(--radius-md);
  font-size: var(--fz-sm);
}
.apply:hover { background: var(--accent-hover); }

.bar {
  height: 6px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}
.bar .fill { height: 100%; background: var(--accent); transition: width var(--t-slow); }
.bar .fill.success { background: var(--success); }
.bar.big { height: 24px; display: flex; align-items: center; padding: 0 8px; }
.bar-text {
  font-size: var(--fz-xs);
  color: var(--fg-0);
  position: relative;
  z-index: 1;
  font-variant-numeric: tabular-nums;
}
</style>
