<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { Icon } from '@iconify/vue'
import { useCommandStore } from '../stores/commands'

const cmds = useCommandStore()
const query = ref('')
const activeIdx = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

const list = computed(() => cmds.filtered(query.value))
const groups = computed(() => {
  const map = new Map<string, typeof list.value>()
  for (const c of list.value) {
    if (!map.has(c.group)) map.set(c.group, [])
    map.get(c.group)!.push(c)
  }
  return Array.from(map.entries())
})

// 全局 indexOf 用于 activeIdx 对齐
function indexOf(id: string) {
  return list.value.findIndex((c) => c.id === id)
}

function close() { cmds.closePalette() }

function run(id: string) {
  cmds.execute(id)
  close()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return }
  if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx.value = Math.min(list.value.length - 1, activeIdx.value + 1); return }
  if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx.value = Math.max(0, activeIdx.value - 1); return }
  if (e.key === 'Enter') {
    e.preventDefault()
    const c = list.value[activeIdx.value]
    if (c) run(c.id)
  }
}

onMounted(() => nextTick(() => inputRef.value?.focus()))
</script>

<template>
  <transition name="fade">
    <div v-if="cmds.paletteOpen" class="overlay" @click.self="close">
      <div class="palette" role="dialog" aria-label="命令面板">
        <div class="input-row">
          <Icon icon="lucide:command" class="lead" />
          <input
            ref="inputRef"
            v-model="query"
            placeholder="输入命令名称…"
            @keydown="onKeyDown"
            spellcheck="false"
          />
          <span class="esc" @click="close">ESC</span>
        </div>

        <div class="results">
          <div v-if="list.length === 0" class="empty">
            <Icon icon="lucide:search-x" />
            <p>未找到匹配命令</p>
          </div>
          <template v-else>
            <template v-for="[group, items] in groups" :key="group">
              <div class="group-title">{{ group }}</div>
              <button
                v-for="c in items"
                :key="c.id"
                class="item"
                :class="{ active: indexOf(c.id) === activeIdx }"
                @click="run(c.id)"
                @mouseenter="activeIdx = indexOf(c.id)"
              >
                <Icon v-if="c.icon" :icon="c.icon" class="ico" />
                <span class="title">{{ c.title }}</span>
                <span v-if="c.shortcut" class="kbd">{{ c.shortcut }}</span>
              </button>
            </template>
          </template>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 200;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  backdrop-filter: blur(3px);
}
.palette {
  width: 560px;
  max-width: 90vw;
  max-height: 70vh;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: in 0.18s ease;
}
@keyframes in {
  from { opacity: 0; transform: translateY(-12px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-0);
}
.input-row .lead { color: var(--fg-3); width: 16px; height: 16px; }
.input-row input {
  flex: 1;
  font-size: var(--fz-lg);
  color: var(--fg-0);
  background: transparent;
}
.input-row input::placeholder { color: var(--fg-3); }
.input-row .esc {
  font-size: var(--fz-xs);
  color: var(--fg-2);
  padding: 2px 6px;
  background: var(--bg-2);
  border: 1px solid var(--border-0);
  border-radius: 4px;
  cursor: pointer;
}

.results { overflow: auto; padding: 6px 0; }

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--fg-3);
  gap: 8px;
}
.empty :deep(svg) { width: 28px; height: 28px; opacity: 0.5; }
.empty p { margin: 0; font-size: var(--fz-sm); }

.group-title {
  font-size: var(--fz-xs);
  color: var(--fg-3);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 14px 4px;
  font-weight: 600;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 14px;
  text-align: left;
  color: var(--fg-1);
  font-size: var(--fz-sm);
  border-left: 2px solid transparent;
  transition: background var(--t-fast), color var(--t-fast);
}
.item.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--fg-0);
  border-left-color: var(--accent);
}
.item .ico { width: 14px; height: 14px; color: var(--fg-3); flex-shrink: 0; }
.item.active .ico { color: var(--accent); }
.item .title { flex: 1; }
.item .kbd {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-2);
  background: var(--bg-2);
  border: 1px solid var(--border-0);
  border-radius: 3px;
  padding: 1px 5px;
  white-space: nowrap;
}

.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
