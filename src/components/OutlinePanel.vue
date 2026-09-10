<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useOutline, type OutlineItem } from '../composables/useOutline'
import { useUIStore } from '../stores/ui'
import VirtualList from './VirtualList.vue'

const ui = useUIStore()
const { items } = useOutline()

const containerRef = ref<HTMLElement | null>(null)
const activeSlug = ref<string>('')

function jumpTo(item: OutlineItem) {
  activeSlug.value = item.slug
  // 通过预览区跳转
  const pane = document.querySelector('.preview-pane') as HTMLElement | null
  if (pane) {
    const target = pane.querySelector<HTMLElement>(`#${CSS.escape(item.slug)}`)
    if (target) {
      pane.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' })
      return
    }
  }
  // 预览不可见时（如仅编辑器），通过编辑器跳转
  // 通过自定义事件让 EditorPane 处理
  window.dispatchEvent(
    new CustomEvent('markwright:jump-to-line', { detail: { line: item.line } })
  )
}

/** 滚动监听：当前可见标题高亮 */
let scrollObserver: IntersectionObserver | null = null

function setupObserver() {
  scrollObserver?.disconnect()
  const pane = document.querySelector('.preview-pane') as HTMLElement | null
  if (!pane) return
  scrollObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const id = (e.target as HTMLElement).id
          if (id) activeSlug.value = id
        }
      }
    },
    {
      root: pane,
      rootMargin: '0px 0px -70% 0px',
      threshold: 0,
    }
  )
  // 监听所有 h1-h6
  pane.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6').forEach((el) => {
    if (el.id) scrollObserver!.observe(el)
  })
}

// 监听预览内容变化重建 observer
let mutationObserver: MutationObserver | null = null
function setupMutation() {
  mutationObserver?.disconnect()
  const pane = document.querySelector('.preview-pane') as HTMLElement | null
  if (!pane) return
  mutationObserver = new MutationObserver(() => {
    nextTick(setupObserver)
  })
  mutationObserver.observe(pane, { childList: true, subtree: true })
}

onMounted(() => {
  nextTick(() => {
    setupObserver()
    setupMutation()
  })
})
onBeforeUnmount(() => {
  scrollObserver?.disconnect()
  mutationObserver?.disconnect()
})

// 监听 ui 切到仅编辑器/分屏 重新挂载
import { watch } from 'vue'
watch(
  () => ui.viewMode,
  () => {
    nextTick(() => {
      setupObserver()
      setupMutation()
    })
  }
)
</script>

<template>
  <div class="outline" ref="containerRef">
    <div v-if="items.length === 0" class="empty">
      <Icon icon="lucide:list-tree" />
      <p>暂无标题</p>
      <span class="hint">在编辑区使用 # ~ ###### 即可生成大纲</span>
    </div>
    <!-- v0.4.8：标题数量多时启用虚拟滚动（>120 条才虚拟化） -->
    <VirtualList v-else class="list" :items="items" :item-height="26" :threshold="120">
      <template #default="{ item }">
        <div
          class="item"
          :class="['lvl-' + item.level, { active: item.slug === activeSlug }]"
          :style="{ paddingLeft: 8 + (item.level - 1) * 12 + 'px' }"
          @click="jumpTo(item)"
          :title="item.text"
        >
          <span class="bullet">
            <span class="hash">H{{ item.level }}</span>
          </span>
          <span class="text">{{ item.text }}</span>
        </div>
      </template>
    </VirtualList>
  </div>
</template>

<style scoped>
.outline {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 6px 0 16px;
  user-select: none;
  display: flex;
  flex-direction: column;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--fg-2);
  text-align: center;
}
.empty :deep(svg) {
  width: 32px;
  height: 32px;
  opacity: 0.4;
}
.empty p { margin: 0; font-size: var(--fz-sm); }
.empty .hint { font-size: var(--fz-xs); color: var(--fg-3); }

.list { flex: 1; min-height: 0; }

.item {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding-right: 8px;
  font-size: var(--fz-sm);
  color: var(--fg-1);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
  position: relative;
}
.item:hover { background: var(--bg-3); color: var(--fg-0); }
.item.active {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--fg-0);
  border-left-color: var(--accent);
}

/* 缩进颜色：H1 深 → H6 浅 */
.item.lvl-1 { font-weight: 600; }
.item.lvl-2 { font-weight: 500; }
.item.lvl-3 { color: var(--fg-2); }
.item.lvl-4,
.item.lvl-5,
.item.lvl-6 { color: var(--fg-3); font-size: var(--fz-xs); }

.bullet {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 16px;
  flex-shrink: 0;
}
.hash {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--fg-3);
  background: var(--bg-2);
  border-radius: 3px;
  padding: 0 4px;
  letter-spacing: 0.5px;
}
.item.active .hash { color: var(--accent); background: var(--bg-3); }
.item.lvl-1 .hash { color: var(--accent); }
.item.lvl-2 .hash { color: var(--success); }

.text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
