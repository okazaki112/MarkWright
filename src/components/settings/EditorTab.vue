<script setup lang="ts">
import { useUIStore } from '../../stores/ui'

const ui = useUIStore()
</script>

<template>
  <section class="settings-list">
    <div class="setting">
      <label>自动保存</label>
      <div class="control">
        <input
          type="checkbox"
          :checked="ui.autoSaveEnabled"
          @change="ui.setAutoSave(($event.target as HTMLInputElement).checked)"
        />
        <span>已保存文件修改后自动写入</span>
      </div>
    </div>
    <div class="setting">
      <label>自动保存间隔</label>
      <div class="control">
        <input
          type="range"
          min="500"
          max="10000"
          step="500"
          :value="ui.autoSaveInterval"
          @input="ui.setAutoSaveInterval(+($event.target as HTMLInputElement).value)"
        />
        <span class="val">{{ ui.autoSaveInterval }}ms</span>
      </div>
    </div>
    <div class="setting">
      <label>滚动同步</label>
      <div class="control">
        <input type="checkbox" :checked="ui.scrollSync" @change="ui.toggleScrollSync" />
        <span>编辑器与预览联动</span>
      </div>
    </div>
    <div class="setting">
      <label>侧边栏</label>
      <div class="control">
        <input type="checkbox" :checked="ui.sidebarOpen" @change="ui.toggleSidebar" />
        <span>显示文件树</span>
      </div>
    </div>
    <div class="setting">
      <label>渲染 Mermaid 图表</label>
      <div class="control">
        <input
          type="checkbox"
          :checked="ui.mermaidEnabled"
          @change="ui.mermaidEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span>识别 ```mermaid 代码块</span>
      </div>
    </div>
    <div class="setting">
      <label>渲染 LaTeX 数学公式</label>
      <div class="control">
        <input
          type="checkbox"
          :checked="ui.katexEnabled"
          @change="ui.katexEnabled = ($event.target as HTMLInputElement).checked"
        />
        <span>识别 $...$ / $$...$$</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-list { display: flex; flex-direction: column; gap: 16px; }
.setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-0);
}
.setting label { font-size: var(--fz-md); color: var(--fg-0); font-weight: 500; }
.setting .control {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--fz-sm);
  color: var(--fg-1);
}
.setting .control input[type='checkbox'] { accent-color: var(--accent); width: 16px; height: 16px; }
.setting .control input[type='range'] { accent-color: var(--accent); width: 160px; }
.setting .control .val { font-variant-numeric: tabular-nums; color: var(--fg-2); font-size: var(--fz-xs); min-width: 60px; text-align: right; }
</style>
