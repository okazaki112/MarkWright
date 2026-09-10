/**
 * 全局「处理中」状态（v0.4.8 新增）
 * - 保存 / 打开文件 / 工作区扫描等耗时操作期间在状态栏显示 spinner
 * - 支持嵌套：内部用计数器，全部完成才隐藏
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useBusyStore = defineStore('busy', () => {
  const count = ref(0)
  const label = ref('')

  const isBusy = computed(() => count.value > 0)

  function begin(text: string) {
    count.value++
    label.value = text
  }

  function end() {
    count.value = Math.max(0, count.value - 1)
    if (count.value === 0) label.value = ''
  }

  /** 包裹一个异步操作，自动维护 busy 状态（异常也会正确收尾） */
  async function run<T>(text: string, fn: () => Promise<T>): Promise<T> {
    begin(text)
    try {
      return await fn()
    } finally {
      end()
    }
  }

  return { isBusy, label, begin, end, run }
})
