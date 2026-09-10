<script setup lang="ts">
import { computed } from 'vue'
import { useFontStore, SYSTEM_FONTS, type FontCategory } from '../../stores/font'

const font = useFontStore()

const categories: { key: FontCategory; label: string; hint: string }[] = [
  { key: 'ui', label: '界面字体', hint: '按钮 / 标签 / 状态栏等 UI 文字' },
  { key: 'serif', label: '正文字体', hint: '预览 / 段落正文' },
  { key: 'display', label: '标题字体', hint: '标题 / 品牌展示' },
  { key: 'mono', label: '代码字体', hint: '编辑器 / 行内代码 / 代码块' },
]

function onInput(cat: FontCategory, value: string) {
  font.setFont(cat, value)
}

const previewFamily = computed(() => font.serif)
const previewSize = computed(() => font.fontSize + 'px')
</script>

<template>
  <section class="font-settings">
    <p class="intro">
      字体已与主题解耦。可直接从下拉建议中选择常见系统字体，也可手动输入系统里已安装的任何字体名
      （如 <code>微软雅黑</code>、<code>Consolas</code>、<code>JetBrains Mono</code>）。
    </p>

    <datalist id="system-fonts">
      <option v-for="f in SYSTEM_FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
    </datalist>

    <div v-for="c in categories" :key="c.key" class="row">
      <div class="meta">
        <div class="label">{{ c.label }}</div>
        <div class="hint">{{ c.hint }}</div>
      </div>
      <input
        class="font-input"
        list="system-fonts"
        :value="font[c.key]"
        placeholder="选择或输入字体名…"
        @input="onInput(c.key, ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="row">
      <div class="meta">
        <div class="label">正文字号</div>
        <div class="hint">预览区域正文大小（{{ font.fontSize }}px）</div>
      </div>
      <div class="size-control">
        <input
          type="range"
          min="12"
          max="22"
          step="1"
          :value="font.fontSize"
          @input="font.setFontSize(+($event.target as HTMLInputElement).value)"
        />
        <span class="val">{{ font.fontSize }}px</span>
      </div>
    </div>

    <div class="preview" :style="{ fontFamily: previewFamily, fontSize: previewSize }">
      永和九年，岁在癸丑，暮春之初，会于会稽山阴之兰亭。<br />
      The quick brown fox jumps over the lazy dog. 1234567890
    </div>

    <div class="actions">
      <button class="reset" @click="font.resetFonts()">恢复默认字体</button>
    </div>
  </section>
</template>

<style scoped>
.font-settings { display: flex; flex-direction: column; gap: 14px; }
.intro { margin: 0; font-size: var(--fz-sm); color: var(--fg-2); line-height: 1.6; }
.intro code {
  padding: 0 4px;
  background: var(--bg-2);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: var(--fz-xs);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-0);
}
.meta { min-width: 0; }
.label { font-size: var(--fz-md); color: var(--fg-0); font-weight: 500; }
.hint { font-size: var(--fz-xs); color: var(--fg-3); margin-top: 2px; }
.font-input {
  flex-shrink: 0;
  width: 260px;
  padding: 6px 8px;
  background: var(--bg-1);
  color: var(--fg-0);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  font-size: var(--fz-sm);
}
.font-input:focus { border-color: var(--accent); outline: none; }
.size-control { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.size-control input[type='range'] { accent-color: var(--accent); width: 160px; }
.size-control .val { font-variant-numeric: tabular-nums; color: var(--fg-2); font-size: var(--fz-xs); min-width: 42px; text-align: right; }
.preview {
  padding: 14px 16px;
  background: var(--bg-1);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  color: var(--fg-0);
  line-height: 1.75;
}
.actions { display: flex; justify-content: flex-end; }
.reset {
  padding: 6px 14px;
  background: var(--bg-2);
  color: var(--fg-1);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-md);
  font-size: var(--fz-sm);
  transition: all var(--t-fast);
}
.reset:hover { background: var(--bg-3); color: var(--fg-0); }
</style>
