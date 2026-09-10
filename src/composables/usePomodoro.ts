/**
 * 番茄钟 · 专注循环（模块级单例）
 *
 * 设计要点：
 *  - **单例**：所有组件（专注浮层、菜单、命令）共享同一份状态与同一个定时器，
 *    避免此前「每次 usePomodoro() 都新建实例 → 各组件各跑各的」的问题。
 *  - 阶段：idle / focus / shortBreak / longBreak；每完成 N 个专注进入长休息。
 *  - 自动流转：专注结束 → 休息；休息结束 → 回到 idle。
 *  - 计数：完成一个专注即写入统计（SQLite），并同步今日番茄数。
 */
import { computed, ref } from 'vue'
import { useStatsStore } from '../stores/stats'

export type PomodoroPhase = 'idle' | 'focus' | 'shortBreak' | 'longBreak'
type ActivePhase = Exclude<PomodoroPhase, 'idle'>

export interface PomodoroDurations {
  focus: number
  shortBreak: number
  longBreak: number
}

export const DEFAULT_DURATIONS: PomodoroDurations = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
}

/* ---------- 模块级单例状态 ---------- */
const phase = ref<PomodoroPhase>('idle')
const remaining = ref(0)
const running = ref(false)
const completedToday = ref(0)
/** 距上次长休息已完成的专注数 */
const focusStreak = ref(0)
const durations = ref<PomodoroDurations>({ ...DEFAULT_DURATIONS })
/** 每完成多少个专注进入一次长休息 */
const longBreakEvery = ref(4)

let timer: number | undefined
let startTs = 0

function clearTimer() {
  if (timer !== undefined) {
    clearInterval(timer)
    timer = undefined
  }
}

const total = computed(() => (phase.value === 'idle' ? 0 : durations.value[phase.value]))
const progress = computed(() => (total.value === 0 ? 0 : 1 - remaining.value / total.value))
/** 当前阶段结束后将进入的阶段 */
const nextPhase = computed<PomodoroPhase>(() => {
  if (phase.value !== 'focus') return 'focus'
  return (focusStreak.value + 1) % longBreakEvery.value === 0 ? 'longBreak' : 'shortBreak'
})

function tick() {
  remaining.value -= 1
  if (remaining.value <= 0) finish()
}

function begin(next: ActivePhase) {
  clearTimer()
  phase.value = next
  remaining.value = durations.value[next]
  running.value = true
  startTs = Math.floor(Date.now() / 1000)
  timer = window.setInterval(tick, 1000)
}

function start(phaseOverride?: ActivePhase) {
  begin(phaseOverride ?? 'focus')
}

function pause() {
  clearTimer()
  running.value = false
}

function resume() {
  if (phase.value !== 'idle' && remaining.value > 0 && !running.value) {
    running.value = true
    timer = window.setInterval(tick, 1000)
  }
}

/** 主按钮语义：未开始→开始专注；进行中→暂停；已暂停→继续 */
function toggle() {
  if (phase.value === 'idle') start('focus')
  else if (running.value) pause()
  else resume()
}

function reset() {
  clearTimer()
  phase.value = 'idle'
  remaining.value = 0
  running.value = false
}

/** 跳过当前阶段（直接结算） */
function skip() {
  if (phase.value !== 'idle') finish()
}

function finish() {
  clearTimer()
  const ended = phase.value
  if (ended === 'focus') {
    const endTs = Math.floor(Date.now() / 1000)
    try {
      useStatsStore().recordPomodoro(startTs, endTs, Math.max(0, endTs - startTs), 'focus')
    } catch {
      /* 非 Pinia 环境忽略 */
    }
    completedToday.value += 1
    focusStreak.value += 1
    begin(focusStreak.value % longBreakEvery.value === 0 ? 'longBreak' : 'shortBreak')
    return
  }
  // 休息结束 → 回到 idle
  reset()
}

/** 从统计库同步「今日已完成番茄数」（打开专注模式时调用） */
function syncToday() {
  try {
    completedToday.value = useStatsStore().summary.today.pomodoros
  } catch {
    /* 忽略 */
  }
}

function setDurations(next: Partial<PomodoroDurations>) {
  durations.value = { ...durations.value, ...next }
}

function setLongBreakEvery(n: number) {
  longBreakEvery.value = Math.max(1, Math.floor(n) || 1)
}

function format(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function usePomodoro() {
  return {
    phase,
    remaining,
    running,
    total,
    progress,
    nextPhase,
    completedToday,
    focusStreak,
    durations,
    longBreakEvery,
    start,
    pause,
    resume,
    toggle,
    reset,
    skip,
    syncToday,
    setDurations,
    setLongBreakEvery,
    format,
  }
}
