<script setup lang="ts" generic="T">
/**
 * 轻量虚拟滚动列表（v0.4.8 新增，零依赖）
 * - items 数量 ≤ threshold 时退化为普通渲染（省掉无谓的计算）
 * - 固定行高，窗口外节点不进入 DOM
 * - 用 rAF 合并滚动事件，避免滚动时高频重算
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    items: T[]
    itemHeight: number
    /** 视口上下额外渲染的行数 */
    buffer?: number
    /** 少于此数量不做虚拟化 */
    threshold?: number
  }>(),
  { buffer: 6, threshold: 80 },
)

const viewport = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewH = ref(0)

const virtual = computed(() => props.items.length > props.threshold)
const totalHeight = computed(() => props.items.length * props.itemHeight)

const start = computed(() => {
  if (!virtual.value) return 0
  const s = Math.floor(scrollTop.value / props.itemHeight) - props.buffer
  return Math.max(0, s)
})
const end = computed(() => {
  if (!virtual.value) return props.items.length
  const visible = Math.ceil(viewH.value / props.itemHeight) + props.buffer * 2
  return Math.min(props.items.length, start.value + visible)
})
const windowItems = computed(() =>
  virtual.value ? props.items.slice(start.value, end.value) : props.items,
)
const offsetY = computed(() => (virtual.value ? start.value * props.itemHeight : 0))

let raf = 0
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    if (viewport.value) scrollTop.value = viewport.value.scrollTop
  })
}

function measure() {
  if (viewport.value) viewH.value = viewport.value.clientHeight
}

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && viewport.value) {
    ro = new ResizeObserver(measure)
    ro.observe(viewport.value)
  }
})
onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  ro?.disconnect()
  ro = null
})

// items 整体替换时回到顶部，避免停留在越界位置
watch(
  () => props.items,
  () => {
    scrollTop.value = 0
    if (viewport.value) viewport.value.scrollTop = 0
  },
)
</script>

<template>
  <div ref="viewport" class="vl-viewport" @scroll.passive="onScroll">
    <div v-if="virtual" class="vl-spacer" :style="{ height: totalHeight + 'px' }">
      <div class="vl-window" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="(item, i) in windowItems"
          :key="start + i"
          class="vl-item"
          :style="{ height: itemHeight + 'px' }"
        >
          <slot :item="item" :index="start + i" />
        </div>
      </div>
    </div>
    <template v-else>
      <div v-for="(item, i) in windowItems" :key="i" class="vl-item">
        <slot :item="item" :index="i" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.vl-viewport {
  height: 100%;
  overflow: auto;
  overflow-anchor: none;
}
.vl-spacer { position: relative; width: 100%; }
.vl-window { position: absolute; top: 0; left: 0; right: 0; will-change: transform; }
.vl-item { display: block; }
</style>
