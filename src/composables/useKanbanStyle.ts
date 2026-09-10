/**
 * Kanban 样式
 * 注入到全局（因为 KanbanBoard 是动态 mount 的独立 Vue 应用）
 */
const css = `
.kanban-host { font-family: var(--font-sans); color: var(--fg-0); }
.kanban-board {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: max-content;
}
.kcol {
  width: 260px;
  background: var(--bg-2);
  border-radius: var(--radius-md);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 80px;
}
.kcol-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 8px;
  border-bottom: 1px solid var(--border-0);
}
.kcol-name { font-weight: 600; font-size: var(--fz-sm); flex: 1; }
.kcol-count {
  font-size: 10px;
  color: var(--fg-2);
  background: var(--bg-3);
  padding: 1px 6px;
  border-radius: 8px;
}
.kbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px;
  color: var(--fg-3); background: transparent;
  transition: all var(--t-fast);
}
.kbtn:hover { background: var(--bg-3); color: var(--fg-0); }
.kbtn.danger:hover { background: rgba(248, 81, 73, 0.15); color: var(--danger); }
.kbtn.small { width: 16px; height: 16px; }

.kcol-body { display: flex; flex-direction: column; gap: 4px; }
.kcard {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-0);
  border-radius: var(--radius-sm);
  cursor: grab;
  transition: all var(--t-fast);
  user-select: none;
}
.kcard:hover { background: var(--bg-3); border-color: var(--border-1); }
.kcard.drag { opacity: 0.5; }
.kcard.done .ktext {
  text-decoration: line-through;
  color: var(--fg-3);
}
.kcard input[type='checkbox'] { accent-color: var(--accent); margin: 0; flex-shrink: 0; }
.kcard .ktext { flex: 1; font-size: var(--fz-sm); word-break: break-word; }
.kcard .kbtn.danger.small { opacity: 0; transition: opacity var(--t-fast); }
.kcard:hover .kbtn.danger.small { opacity: 1; }

.kadd-card, .kadd-col {
  display: flex; align-items: center; justify-content: center; gap: 4px;
  padding: 6px 8px;
  color: var(--fg-3);
  font-size: var(--fz-xs);
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-0);
  transition: all var(--t-fast);
}
.kadd-card:hover, .kadd-col:hover {
  background: var(--bg-3);
  color: var(--fg-0);
  border-color: var(--border-1);
  border-style: solid;
}
.kadd-col {
  width: 260px;
  min-width: 260px;
  padding: 10px;
  background: transparent;
}
`

if (typeof document !== 'undefined' && !document.getElementById('kanban-style')) {
  const el = document.createElement('style')
  el.id = 'kanban-style'
  el.textContent = css
  document.head.appendChild(el)
}
