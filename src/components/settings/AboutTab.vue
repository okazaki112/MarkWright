<script setup lang="ts">
const techs = ['Tauri 2', 'Vue 3', 'Vite', 'TypeScript', 'CodeMirror 6', 'markdown-it', 'Mermaid', 'KaTeX', 'Chart.js', 'AES-256-GCM', 'SQLite']
</script>

<template>
  <section class="about">
    <img class="about-logo" src="/favicon.png" alt="MarkWright" />
    <h3>MarkWright</h3>
    <p class="about-tagline">专业 Markdown 编辑器</p>
    <p class="about-version">v0.4.8</p>
    <div class="about-tech">
      <span v-for="t in techs" :key="t" class="chip">{{ t }}</span>
    </div>
    <p class="about-text">
      一款为认真写作而生的 Markdown 桌面编辑器。
      完全本地、零联网、零云同步。
    </p>
    <p class="about-license">MIT License · 自由使用与分发</p>
  </section>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
}
.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  object-fit: contain;
  margin-bottom: 12px;
  box-shadow: var(--shadow-md);
}
.about h3 { margin: 0; font-size: var(--fz-xl); color: var(--fg-0); }
.about-tagline { color: var(--fg-1); margin: 4px 0 2px; }
.about-version { color: var(--fg-2); font-size: var(--fz-xs); margin: 0 0 16px; }
.about-tech { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 16px; }
.chip {
  padding: 2px 10px;
  background: var(--bg-2);
  border: 1px solid var(--border-0);
  border-radius: 12px;
  font-size: var(--fz-xs);
  color: var(--fg-1);
}
.about-text { color: var(--fg-1); font-size: var(--fz-sm); max-width: 480px; line-height: 1.6; }
.about-license { color: var(--fg-3); font-size: var(--fz-xs); margin-top: 8px; }
</style>
