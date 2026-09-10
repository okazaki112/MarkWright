<script setup lang="ts">
/**
 * 专注模式浮层
 * - 不再用整屏遮罩盖住编辑器：外壳由 App.vue 在专注态隐藏，
 *   这里只提供一个**悬浮番茄钟**（右下角）+ 顶部退出按钮，正文始终可见可写。
 * - 状态完全来自 ui store 与番茄钟单例，二者都是响应式的。
 */
import { computed, onMounted } from 'vue'
import { Icon } from '@iconify/vue'
import { usePomodoro } from '../composables/usePomodoro'
import { useUIStore } from '../stores/ui'
import { useStatsStore } from '../stores/stats'
import { useDocumentStore } from '../stores/document'

const pomo = usePomodoro()
const ui = useUIStore()
const stats = useStatsStore()
const doc = useDocumentStore()

onMounted(() => pomo.syncToday())

const phaseLabel = computed(() => {
  switch (pomo.phase.value) {
    case 'focus': return '专注中'
    case 'shortBreak': return '短休息'
    case 'longBreak': return '长休息'
    default: return '未开始'
  }
})
const phaseColor = computed(() => {
  switch (pomo.phase.value) {
    case 'focus': return 'var(--accent)'
    case 'shortBreak': return 'var(--success)'
    case 'longBreak': return 'var(--info)'
    default: return 'var(--fg-3)'
  }
})
const primaryLabel = computed(() => {
  if (pomo.phase.value === 'idle') return '开始专注'
  return pomo.running.value ? '暂停' : '继续'
})
const todayProgress = computed(() =>
  Math.min(100, ((stats.summary.today.words || 0) / (stats.dailyGoal || 1)) * 100),
)
const circumference = 2 * Math.PI * 26

/** 常用时长预设 */
const PRESETS: { label: string; focus: number; shortBreak: number; longBreak: number }[] = [
  { label: '25 / 5', focus: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 },
  { label: '50 / 10', focus: 50 * 60, shortBreak: 10 * 60, longBreak: 20 * 60 },
]
const activePreset = computed(() => pomo.durations.value.focus)
function applyPreset(p: (typeof PRESETS)[number]) {
  pomo.setDurations({ focus: p.focus, shortBreak: p.shortBreak, longBreak: p.longBreak })
  // 已开始时切换预设：按新时长重启当前阶段
  const ph = pomo.phase.value
  if (ph === 'idle') return
  pomo.start(ph)
}
</script>

<template>
  <div v-if="ui.focusMode" class="focus-layer">
    <button class="exit-btn" @click="ui.setFocusMode(false)" title="退出专注 (F11)">
      <Icon icon="lucide:minimize-2" />
      <span>退出专注</span>
    </button>

    <section class="pomo-card">
      <div class="pomo-main">
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 60 60">
            <circle class="ring-bg" cx="30" cy="30" r="26" />
            <circle
              class="ring-fg"
              cx="30" cy="30" r="26"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="circumference * (1 - pomo.progress.value)"
              :style="{ stroke: phaseColor }"
            />
          </svg>
          <span class="ring-dot" :style="{ background: phaseColor }" />
        </div>

        <div class="pomo-info">
          <div class="pomo-time">{{ pomo.format(pomo.remaining.value) }}</div>
          <div class="pomo-phase" :style="{ color: phaseColor }">
            {{ phaseLabel }}<template v-if="pomo.phase.value !== 'idle'">
              · 今日 {{ pomo.completedToday.value }}/{{ stats.pomodoroGoal }}
            </template>
          </div>
        </div>
      </div>

      <div class="pomo-actions">
        <button class="ctrl primary" @click="pomo.toggle()">
          <Icon :icon="pomo.running.value ? 'lucide:pause' : 'lucide:play'" />
          {{ primaryLabel }}
        </button>
        <button
          v-if="pomo.phase.value !== 'idle'"
          class="ctrl ghost"
          @click="pomo.skip()"
          title="跳过当前阶段"
        >
          <Icon icon="lucide:skip-forward" />
        </button>
        <button
          v-if="pomo.phase.value !== 'idle'"
          class="ctrl ghost"
          @click="pomo.reset()"
          title="重置"
        >
          <Icon icon="lucide:rotate-ccw" />
        </button>
      </div>

      <div class="presets">
        <button
          v-for="p in PRESETS"
          :key="p.label"
          class="preset"
          :class="{ active: activePreset === p.focus }"
          @click="applyPreset(p)"
        >
          {{ p.label }}
        </button>
      </div>

      <div class="pomo-stats">
        <span>本文 {{ doc.wordCount }} 字</span>
        <span>今日 {{ stats.summary.today.words }}/{{ stats.dailyGoal }}</span>
        <div class="goal-bar"><div class="goal-fill" :style="{ width: todayProgress + '%' }" /></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.focus-layer {
  position: fixed;
  inset: 0;
  z-index: 500;
  pointer-events: none;
}

.exit-btn {
  position: absolute;
  top: 14px;
  right: 16px;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-md);
  background: var(--bg-2);
  border: 1px solid var(--border-0);
  color: var(--fg-2);
  font-size: var(--fz-sm);
  opacity: 0.55;
  transition: opacity var(--t-fast), background var(--t-fast), color var(--t-fast);
}
.exit-btn:hover { opacity: 1; background: var(--bg-3); color: var(--fg-0); }
.exit-btn :deep(svg) { width: 14px; height: 14px; }

.pomo-card {
  position: absolute;
  right: 20px;
  bottom: 20px;
  pointer-events: auto;
  width: 260px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-elevated, var(--bg-1));
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.pomo-main { display: flex; align-items: center; gap: 12px; }
.ring-wrap { position: relative; width: 60px; height: 60px; flex-shrink: 0; }
.ring { width: 60px; height: 60px; transform: rotate(-90deg); }
.ring-bg { fill: none; stroke: var(--border-0); stroke-width: 4; }
.ring-fg {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 1s linear;
}
.ring-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  opacity: 0.5;
}

.pomo-info { min-width: 0; }
.pomo-time {
  font-size: 30px;
  font-weight: 300;
  color: var(--fg-0);
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  line-height: 1.1;
}
.pomo-phase { font-size: var(--fz-xs); margin-top: 2px; }

.pomo-actions { display: flex; gap: 6px; }
.ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  background: var(--bg-2);
  border: 1px solid var(--border-0);
  color: var(--fg-0);
  font-size: var(--fz-sm);
  transition: background var(--t-fast);
}
.ctrl:hover { background: var(--bg-3); }
.ctrl.primary { flex: 1; background: var(--accent); border-color: var(--accent); color: #fff; }
.ctrl.primary:hover { background: var(--accent-hover, var(--accent)); }
.ctrl.ghost { background: transparent; padding: 0 9px; }
.ctrl :deep(svg) { width: 14px; height: 14px; }

.presets { display: flex; gap: 6px; }
.preset {
  flex: 1;
  height: 24px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-0);
  background: transparent;
  color: var(--fg-2);
  font-size: var(--fz-xs);
  font-family: var(--font-mono);
  transition: all var(--t-fast);
}
.preset:hover { background: var(--bg-2); color: var(--fg-0); }
.preset.active { border-color: var(--accent); color: var(--accent); }

.pomo-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: var(--fz-xs);
  color: var(--fg-3);
}
.goal-bar {
  flex-basis: 100%;
  height: 3px;
  background: var(--bg-2);
  border-radius: 2px;
  overflow: hidden;
}
.goal-fill {
  height: 100%;
  background: var(--accent);
  transition: width var(--t-slow);
}
</style>
