<script setup lang="ts">
/**
 * 模板选择器浮层 - Ctrl+J
 */
import { ref, onMounted, nextTick, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { useTemplatesStore, type Template } from '../stores/templates'

const tpl = useTemplatesStore()
const query = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const list = computed(() => {
  if (!query.value) return tpl.templates
  const q = query.value.toLowerCase()
  return tpl.templates.filter(
    (t) => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q)
  )
})

function pick(t: Template) {
  window.dispatchEvent(
    new CustomEvent('markwright:editor-cmd', {
      detail: { cmd: 'insertText', text: t.body },
    })
  )
  tpl.close()
}

function remove(t: Template) {
  if (t.builtIn) return
  if (confirm(`删除模板「${t.name}」？`)) {
    tpl.remove(t.id)
  }
}

function addCustom() {
  const name = prompt('模板名')
  if (!name) return
  const body = prompt('模板内容（markdown）')
  if (!body) return
  tpl.add({ name, icon: 'lucide:file-plus', body })
}

onMounted(() => nextTick(() => inputRef.value?.focus()))
</script>

<template>
  <transition name="fade">
    <div v-if="tpl.panelOpen" class="overlay" @click.self="tpl.close">
      <div class="panel">
        <div class="input-row">
          <Icon icon="lucide:layout-template" class="lead" />
          <input
            ref="inputRef"
            v-model="query"
            placeholder="搜索模板…"
            spellcheck="false"
          />
          <button class="newbtn" @click="addCustom" title="新建模板">
            <Icon icon="lucide:plus" />
          </button>
          <span class="esc" @click="tpl.close">ESC</span>
        </div>
        <div class="results">
          <button
            v-for="t in list"
            :key="t.id"
            class="item"
            @click="pick(t)"
          >
            <Icon :icon="t.icon" class="ico" />
            <div class="info">
              <div class="title">
                {{ t.name }}
                <span v-if="t.builtIn" class="tag">内置</span>
              </div>
              <div class="preview">{{ t.body.split('\n').slice(0, 2).join(' ').slice(0, 80) }}…</div>
            </div>
            <button v-if="!t.builtIn" class="del" @click.stop="remove(t)">
              <Icon icon="lucide:trash-2" />
            </button>
          </button>
          <div v-if="list.length === 0" class="empty">没有匹配模板</div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.55);
  z-index: 200; display: flex; align-items: flex-start; justify-content: center;
  padding-top: 12vh; backdrop-filter: blur(3px);
}
.panel {
  width: 560px; max-width: 90vw; max-height: 70vh;
  background: var(--bg-elevated); border: 1px solid var(--border-0);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  display: flex; flex-direction: column; overflow: hidden;
  animation: in 0.18s ease;
}
@keyframes in { from { opacity: 0; transform: translateY(-12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
.input-row {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px; border-bottom: 1px solid var(--border-0);
}
.input-row .lead { color: var(--fg-3); width: 16px; height: 16px; }
.input-row input { flex: 1; font-size: var(--fz-lg); color: var(--fg-0); }
.input-row input::placeholder { color: var(--fg-3); }
.newbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 4px;
  background: var(--bg-2); color: var(--fg-2);
}
.newbtn:hover { background: var(--accent); color: white; }
.newbtn :deep(svg) { width: 13px; height: 13px; }
.esc { font-size: var(--fz-xs); color: var(--fg-2); padding: 2px 6px; background: var(--bg-2); border: 1px solid var(--border-0); border-radius: 4px; cursor: pointer; }
.results { overflow: auto; padding: 6px 0; }
.item {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 10px 14px; text-align: left;
  color: var(--fg-1); border-left: 2px solid transparent;
  transition: background var(--t-fast), color var(--t-fast);
}
.item:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--fg-0); border-left-color: var(--accent); }
.item .ico { width: 16px; height: 16px; color: var(--fg-3); flex-shrink: 0; }
.item:hover .ico { color: var(--accent); }
.info { flex: 1; min-width: 0; }
.title { display: flex; align-items: center; gap: 6px; font-size: var(--fz-sm); color: var(--fg-0); font-weight: 500; }
.tag { font-size: 9px; color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); padding: 1px 5px; border-radius: 3px; font-weight: 400; }
.preview { font-size: var(--fz-xs); color: var(--fg-3); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.del {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 4px;
  color: var(--fg-3);
}
.del:hover { background: rgba(248, 81, 73, 0.15); color: var(--danger); }
.del :deep(svg) { width: 12px; height: 12px; }
.empty { padding: 30px; text-align: center; color: var(--fg-3); font-size: var(--fz-sm); }
.fade-enter-active, .fade-leave-active { transition: opacity var(--t-base); }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
