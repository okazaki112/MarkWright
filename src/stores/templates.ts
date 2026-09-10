/**
 * 日记模板 - 一键插入预定义 markdown
 * - 4 个内置：今日 / 周报 / 月度复盘 / 读书笔记
 * - 自定义模板（localStorage 存储）
 * - 插入位置：当前光标
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Template {
  id: string
  name: string
  icon: string
  body: string
  builtIn?: boolean
}

const STORAGE_KEY = 'markwright:templates'

function defaultBody(name: string): string {
  const date = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()]
  return `# ${name} · ${ymd} 周${weekday}

## 📋 今日要事

- [ ]
- [ ]
- [ ]

## ✍️ 工作记录


## 💡 灵感与想法


## 📚 学习


## 🌙 今日反思

- 做得好：
- 不足：
- 明日重点：
`
}

const BUILTIN: Template[] = [
  { id: 'today', name: '今日日记', icon: 'lucide:sun', body: defaultBody('今日日记'), builtIn: true },
  {
    id: 'weekly', name: '周报', icon: 'lucide:calendar-days', builtIn: true, body: `# 周报 · 第${Math.ceil(new Date().getDate() / 7)}周

## 本周完成
-

## 本周数据
- 番茄数：
- 字数：

## 下周计划
-

## 反思
`
  },
  {
    id: 'monthly', name: '月度复盘', icon: 'lucide:calendar-range', builtIn: true, body: `# ${new Date().getMonth() + 1}月复盘

## 本月关键成果
1.
2.
3.

## 数据回顾
- 总字数：
- 番茄完成数：
- 工作日均：

## 下月目标
1.
2.
3.
`
  },
  {
    id: 'book', name: '读书笔记', icon: 'lucide:book-open', builtIn: true, body: `# 读书笔记 · 《》

## 作者 / 出版社 / 年份


## 一句话总结


## 核心观点
1.
2.
3.

## 触动我的段落

> 

## 我的应用
- 工作：
- 生活：
`
  },
]

function readStored(): Template[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return BUILTIN
    const custom = JSON.parse(raw) as Template[]
    return [...BUILTIN, ...custom]
  } catch {
    return BUILTIN
  }
}

function writeStored(list: Template[]) {
  const customs = list.filter((t) => !t.builtIn)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customs))
  } catch {
    /* ignore */
  }
}

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<Template[]>(readStored())
  const panelOpen = ref(false)

  function open() { panelOpen.value = true }
  function close() { panelOpen.value = false }

  function add(t: Omit<Template, 'id' | 'builtIn'>) {
    const id = 't_' + Date.now().toString(36)
    templates.value.push({ ...t, id })
    writeStored(templates.value)
  }

  function remove(id: string) {
    const t = templates.value.find((x) => x.id === id)
    if (!t || t.builtIn) return
    templates.value = templates.value.filter((x) => x.id !== id)
    writeStored(templates.value)
  }

  return { templates, panelOpen, open, close, add, remove }
})
