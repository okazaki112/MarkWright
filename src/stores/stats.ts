/**
 * 写作统计 store - 与 Rust SQLite 通讯
 * - 每日字数 / 番茄数 / 写作时长
 * - 字数事件每次编辑器内容变化时记录 delta
 * - 统计弹层用
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useDocumentStore } from './document'

export interface DailyStat {
  date: string         // YYYY-MM-DD
  words: number
  pomodoros: number
  duration_sec: number
  sessions: number
}

export interface Summary {
  today: { words: number; pomodoros: number; duration: number }
  week: { words: number; pomodoros: number; duration: number }
  total: { words: number; pomodoros: number; duration: number }
}

export const useStatsStore = defineStore('stats', () => {
  const initialized = ref(false)
  const dailyStats = ref<DailyStat[]>([])
  const summary = ref<Summary>({
    today: { words: 0, pomodoros: 0, duration: 0 },
    week: { words: 0, pomodoros: 0, duration: 0 },
    total: { words: 0, pomodoros: 0, duration: 0 },
  })
  // 字数目标
  const dailyGoal = ref<number>(500)
  // 番茄钟目标
  const pomodoroGoal = ref<number>(4)

  async function init() {
    if (initialized.value) return
    try {
      await invoke('init_db_cmd')
      // 读取目标
      const g = await invoke<string | null>('get_setting', { key: 'dailyGoal' })
      if (g) dailyGoal.value = parseInt(g, 10) || 500
      const p = await invoke<string | null>('get_setting', { key: 'pomodoroGoal' })
      if (p) pomodoroGoal.value = parseInt(p, 10) || 4
      await refresh()
      initialized.value = true
    } catch (e) {
      console.warn('stats init failed', e)
    }
  }

  async function refresh() {
    try {
      dailyStats.value = await invoke<DailyStat[]>('get_daily_stats', { days: 365 })
      summary.value = await invoke<Summary>('get_summary')
    } catch (e) {
      console.warn('stats refresh failed', e)
    }
  }

  async function recordWordEvent(delta: number, total: number, tab: string, durationSec = 0) {
    if (delta <= 0) return
    try {
      await invoke('record_word_event', {
        event: {
          ts: Math.floor(Date.now() / 1000),
          delta,
          total,
          tab,
          duration: durationSec,
        },
      })
    } catch (e) {
      /* 静默 */
    }
  }

  async function recordPomodoro(startTs: number, endTs: number, durationSec: number, kind: string) {
    try {
      await invoke('record_pomodoro', {
        start_ts: startTs,
        end_ts: endTs,
        duration_sec: durationSec,
        kind,
      })
      await refresh()
    } catch (e) {
      console.warn('recordPomodoro failed', e)
    }
  }

  async function setDailyGoal(n: number) {
    dailyGoal.value = n
    try { await invoke('set_setting', { key: 'dailyGoal', value: String(n) }) } catch {}
  }
  async function setPomodoroGoal(n: number) {
    pomodoroGoal.value = n
    try { await invoke('set_setting', { key: 'pomodoroGoal', value: String(n) }) } catch {}
  }

  /** 字数追踪：监听 activeTab.content 增量 */
  let lastWords = 0
  /** 本次写作会话起点（用于上报 duration） */
  let trackStartTs = 0
  /**
   * v0.4.8：按键级变更不再逐次 invoke。
   * 累积 delta，1.5s 静默后合并上报一次，把 IPC 次数从 O(击键数) 降到 O(1/1.5s)。
   */
  const FLUSH_MS = 1500
  let pendingDelta = 0
  let pendingTotal = 0
  let pendingTab = ''
  let flushTimer: number | undefined

  function flushTracking() {
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = undefined
    }
    if (pendingDelta <= 0) {
      pendingDelta = 0
      return
    }
    const delta = pendingDelta
    const total = pendingTotal
    const tab = pendingTab
    const durationSec = trackStartTs
      ? Math.max(0, Math.round((Date.now() - trackStartTs) / 1000))
      : 0
    pendingDelta = 0
    // 不 await：避免调用方被 IPC 延迟拖慢
    void recordWordEvent(delta, total, tab, durationSec)
  }

  function startTracking() {
    const doc = useDocumentStore()
    lastWords = countWords(doc.activeTab?.content ?? '')
    trackStartTs = Date.now()
    return lastWords
  }

  function trackChange() {
    const doc = useDocumentStore()
    const now = countWords(doc.activeTab?.content ?? '')
    const delta = now - lastWords
    if (delta > 0) {
      pendingDelta += delta
      pendingTotal = now
      pendingTab = doc.activeTab?.name ?? ''
    } else if (pendingDelta > 0) {
      // 内容被删减：总数变了，更新待上报的 total 但保留已产生的增量
      pendingTotal = now
    }
    lastWords = now

    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = window.setTimeout(flushTracking, FLUSH_MS)
  }

  function trackSwitch() {
    // 切 tab 前先把上一个 tab 的增量落库，再重新锚定
    flushTracking()
    const doc = useDocumentStore()
    lastWords = countWords(doc.activeTab?.content ?? '')
    trackStartTs = Date.now()
  }

  return {
    initialized,
    dailyStats,
    summary,
    dailyGoal,
    pomodoroGoal,
    init,
    refresh,
    recordWordEvent,
    recordPomodoro,
    setDailyGoal,
    setPomodoroGoal,
    startTracking,
    trackChange,
    trackSwitch,
    flushTracking,
  }
})

export function countWords(text: string): number {
  const cjk = (text.match(/[一-龥]/g) || []).length
  const ascii = (text.match(/[A-Za-z0-9_]+/g) || []).length
  return cjk + ascii
}
