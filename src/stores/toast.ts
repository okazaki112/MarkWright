/**
 * Toast 通知系统 - 统一替代 22+ 处 console
 * 类型：info / success / warning / error
 * 自动 4s 消失，可手动关闭
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  text: string
  detail?: string
  /** 0 = 默认 4s；传 0 表示常驻；可手动 dismiss */
  duration: number
}

let nextId = 1

export const useToastStore = defineStore('toast', () => {
  const items = ref<Toast[]>([])

  function push(t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) {
    const id = nextId++
    const item: Toast = {
      id,
      kind: t.kind,
      text: t.text,
      detail: t.detail,
      duration: t.duration ?? 4000,
    }
    items.value.push(item)
    if (item.duration > 0) {
      setTimeout(() => dismiss(id), item.duration)
    }
    return id
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id)
  }

  function clear() {
    items.value = []
  }

  /** 便捷方法 */
  function info(text: string, detail?: string) { return push({ kind: 'info', text, detail }) }
  function success(text: string, detail?: string) { return push({ kind: 'success', text, detail }) }
  function warn(text: string, detail?: string) { return push({ kind: 'warning', text, detail }) }
  function error(text: string, detail?: string) { return push({ kind: 'error', text, detail, duration: 6000 }) }

  return { items, push, dismiss, clear, info, success, warn, error }
})
