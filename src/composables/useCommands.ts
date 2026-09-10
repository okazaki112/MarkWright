/**
 * 集中所有命令 + 全局快捷键
 * 替代 useShortcuts.ts，所有键位只此一处定义
 */
import { onMounted, onBeforeUnmount } from 'vue'
import { useCommandStore, type Command } from '../stores/commands'
import { useDocumentStore } from '../stores/document'
import { useFileSystem } from './useFileSystem'
import { useUIStore } from '../stores/ui'
import { useThemeStore } from '../stores/theme'
import { exportHtml, exportPdf, copyHtmlToClipboard } from './useExport'
import { exportDocx } from './useExportDocx'
import { useTemplatesStore } from '../stores/templates'
import { useWhiteNoise } from './useWhiteNoise'
import { useWorkspaceActions } from './useWorkspaceActions'
import { usePomodoro } from './usePomodoro'
import { useVault } from './useVault'
import { useToastStore } from '../stores/toast'

/** 编辑器命令：通过 window 事件转发给 EditorPane */
function editorCmd(cmd: string, text?: string) {
  window.dispatchEvent(new CustomEvent('markwright:editor-cmd', { detail: { cmd, text } }))
}

/** 将快捷键字符串解析为匹配要素（导出用于测试） */
export function shortcutToEvent(shortcut: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } {
  const parts = shortcut.toLowerCase().split('+').map((p) => p.trim())
  return {
    ctrl: parts.includes('ctrl') || parts.includes('cmd') || parts.includes('⌘'),
    shift: parts.includes('shift') || parts.includes('⇧'),
    alt: parts.includes('alt') || parts.includes('opt'),
    key: parts[parts.length - 1],
  }
}

/** 判断键盘事件是否匹配某快捷键（导出用于测试） */
export function matchShortcut(e: KeyboardEvent, sc: string): boolean {
  const want = shortcutToEvent(sc)
  if ((e.ctrlKey || e.metaKey) !== want.ctrl) return false
  if (e.shiftKey !== want.shift) return false
  if (e.altKey !== want.alt) return false
  return e.key.toLowerCase() === want.key
}

export function useCommands() {
  const cmds = useCommandStore()
  const doc = useDocumentStore()
  const fs = useFileSystem()
  const ui = useUIStore()
  const theme = useThemeStore()
  const wsActions = useWorkspaceActions()
  const pomo = usePomodoro()
  const vault = useVault()
  const toasts = useToastStore()

  const list: Command[] = [
    // 文件
    { id: 'file.new', title: '新建文件', group: '文件', shortcut: 'Ctrl+N', icon: 'lucide:file-plus', run: () => fs.newFile() },
    { id: 'file.open', title: '打开文件', group: '文件', shortcut: 'Ctrl+O', icon: 'lucide:folder-open', run: () => fs.openFile() },
    { id: 'file.save', title: '保存', group: '文件', shortcut: 'Ctrl+S', icon: 'lucide:save', run: () => fs.save() },
    { id: 'file.saveAs', title: '另存为', group: '文件', shortcut: 'Ctrl+Shift+S', icon: 'lucide:save-all', run: () => fs.saveAs() },
    { id: 'file.quickOpen', title: '快速打开文件', group: '文件', shortcut: 'Ctrl+P', icon: 'lucide:search', run: () => cmds.openQuickOpen() },
    { id: 'file.close', title: '关闭当前标签', group: '文件', shortcut: 'Ctrl+W', icon: 'lucide:x', run: () => {
      const t = doc.activeTab
      if (t) doc.closeTab(t.id)
    } },
    { id: 'file.revert', title: '放弃修改（恢复上次保存）', group: '文件', icon: 'lucide:undo-2', run: () => fs.confirmRevert() },

    // 工作区
    { id: 'workspace.open', title: '打开文件夹作为工作区', group: '工作区', icon: 'lucide:folder-plus', run: () => wsActions.open() },
    { id: 'workspace.switch', title: '切换到其他工作区…', group: '工作区', icon: 'lucide:repeat-2', run: () => wsActions.switchTo() },
    { id: 'workspace.refresh', title: '刷新工作区文件树', group: '工作区', icon: 'lucide:refresh-cw', run: () => wsActions.refresh() },
    { id: 'workspace.close', title: '关闭当前工作区', group: '工作区', icon: 'lucide:folder-x', run: () => wsActions.close() },

    // 编辑
    { id: 'edit.find', title: '查找与替换', group: '编辑', shortcut: 'Ctrl+H', icon: 'lucide:replace', run: () => cmds.openSearch() },
    { id: 'edit.gotoLine', title: '跳转到行', group: '编辑', shortcut: 'Ctrl+G', icon: 'lucide:arrow-down-1-0', run: () => cmds.openJumpLine() },
    { id: 'edit.duplicateLine', title: '复制当前行', group: '编辑', icon: 'lucide:copy', run: () => editorCmd('duplicateLine') },
    { id: 'edit.deleteLine', title: '删除当前行', group: '编辑', icon: 'lucide:trash-2', run: () => editorCmd('deleteLine') },
    { id: 'edit.toggleComment', title: '切换注释', group: '编辑', shortcut: 'Ctrl+/', icon: 'lucide:message-square', run: () => editorCmd('toggleComment') },
    { id: 'edit.insertDate', title: '插入当前日期', group: '编辑', icon: 'lucide:calendar', run: () => editorCmd('insertText', new Date().toLocaleDateString('zh-CN')) },
    { id: 'edit.insertTime', title: '插入当前时间', group: '编辑', icon: 'lucide:clock', run: () => editorCmd('insertText', new Date().toLocaleTimeString('zh-CN')) },

    // 格式（Markdown 语法快捷插入，行首前缀可切换）
    { id: 'format.h1', title: '一级标题', group: '格式', icon: 'lucide:heading-1', run: () => editorCmd('prefixLine', '# ') },
    { id: 'format.h2', title: '二级标题', group: '格式', icon: 'lucide:heading-2', run: () => editorCmd('prefixLine', '## ') },
    { id: 'format.h3', title: '三级标题', group: '格式', icon: 'lucide:heading-3', run: () => editorCmd('prefixLine', '### ') },
    { id: 'format.bulletList', title: '无序列表', group: '格式', shortcut: 'Ctrl+Shift+8', icon: 'lucide:list', run: () => editorCmd('prefixLine', '- ') },
    { id: 'format.orderedList', title: '有序列表', group: '格式', shortcut: 'Ctrl+Shift+7', icon: 'lucide:list-ordered', run: () => editorCmd('prefixLine', '1. ') },
    { id: 'format.taskList', title: '任务列表', group: '格式', icon: 'lucide:list-checks', run: () => editorCmd('prefixLine', '- [ ] ') },
    { id: 'format.quote', title: '引用块', group: '格式', shortcut: 'Ctrl+Shift+9', icon: 'lucide:quote', run: () => editorCmd('prefixLine', '> ') },
    { id: 'format.codeBlock', title: '代码块', group: '格式', icon: 'lucide:code', run: () => editorCmd('insertText', '```\n\n```') },
    { id: 'format.table', title: '表格', group: '格式', icon: 'lucide:table', run: () => editorCmd('insertText', '| 列 1 | 列 2 |\n| --- | --- |\n|  |  |') },
    { id: 'format.hr', title: '分隔线', group: '格式', icon: 'lucide:minus', run: () => editorCmd('insertText', '\n---\n') },
    { id: 'format.renumber', title: '重排有序列表序号', group: '格式', icon: 'lucide:list-restart', run: () => editorCmd('renumberList') },

    // 视图
    { id: 'view.split', title: '分屏视图', group: '视图', icon: 'lucide:columns-2', run: () => ui.setViewMode('split') },
    { id: 'view.editor', title: '仅编辑器', group: '视图', icon: 'lucide:square-pen', run: () => ui.setViewMode('editor') },
    { id: 'view.preview', title: '仅预览', group: '视图', icon: 'lucide:eye', run: () => ui.setViewMode('preview') },
    { id: 'view.toggleSidebar', title: '切换侧边栏', group: '视图', shortcut: 'Ctrl+B', icon: 'lucide:panel-left', run: () => ui.toggleSidebar() },
    { id: 'view.resetSidebarWidth', title: '重置侧边栏宽度', group: '视图', icon: 'lucide:panel-left-dashed', run: () => ui.resetSidebarWidth() },
    { id: 'view.toggleScrollSync', title: '切换滚动同步', group: '视图', icon: 'lucide:link-2', run: () => ui.toggleScrollSync() },
    { id: 'view.focus', title: '专注模式', group: '视图', shortcut: 'F11', icon: 'lucide:focus', run: () => ui.toggleFocusMode() },

    // 导出
    { id: 'export.pdf', title: '导出为 PDF', group: '导出', icon: 'lucide:file-text', run: () => exportPdf() },
    { id: 'export.html', title: '导出为 HTML', group: '导出', icon: 'lucide:code', run: () => exportHtml() },
    { id: 'export.docx', title: '导出为 DOCX', group: '导出', icon: 'lucide:file-type', run: () => exportDocx() },
    { id: 'export.copy', title: '复制富文本', group: '导出', icon: 'lucide:clipboard-copy', run: () => copyHtmlToClipboard() },

    // 主题
    { id: 'theme.next', title: '切换下一个主题', group: '主题', icon: 'lucide:palette', run: () => theme.nextTheme() },
    { id: 'theme.open', title: '主题设置', group: '主题', icon: 'lucide:settings-2', run: () => theme.openSettings() },

    // 加密 / 备份
    { id: 'vault.open', title: '打开加密 Vault', group: '加密', icon: 'lucide:lock', run: () => window.dispatchEvent(new CustomEvent('markwright:open-vault')) },
    { id: 'vault.encryptCurrent', title: '就地加密当前文件', group: '加密', icon: 'lucide:file-lock', run: async () => {
      const path = doc.activeTab?.path
      if (!path) { toasts.warn('无法加密', '当前文档未保存'); return }
      try {
        await vault.encryptFileInPlace(path)
        toasts.success('已加密', `${path}（内容已变为密文）`)
      } catch (e) {
        if (String(e).includes('已取消')) toasts.info('已取消加密', '需要主密码')
        else toasts.error('加密失败', String(e))
      }
    } },
    { id: 'vault.lock', title: '锁定加密 Vault', group: '加密', icon: 'lucide:lock-keyhole', run: () => {
      vault.lock()
      toasts.info('已锁定', '后续保存加密文件需重新输入主密码')
    } },
    { id: 'vault.backup', title: '备份当前文件（明文副本）', group: '加密', icon: 'lucide:archive', run: async () => {
      const path = doc.activeTab?.path
      if (!path) { toasts.warn('无法备份', '当前文档未保存'); return }
      const result = await vault.backup(path)
      if (result) toasts.success('已备份', result)
      else toasts.error('备份失败', '未设置工作区')
    } },

    // 专注写作
    { id: 'focus.pomodoro', title: '开始 / 暂停番茄钟', group: '专注', shortcut: 'F10', icon: 'lucide:timer', run: () => pomo.toggle() },
    { id: 'focus.pomodoroStart', title: '开始专注（25 分钟）', group: '专注', icon: 'lucide:play', run: () => pomo.start('focus') },
    { id: 'focus.pomodoroShort', title: '开始短休息（5 分钟）', group: '专注', icon: 'lucide:coffee', run: () => pomo.start('shortBreak') },
    { id: 'focus.pomodoroLong', title: '开始长休息（15 分钟）', group: '专注', icon: 'lucide:sofa', run: () => pomo.start('longBreak') },
    { id: 'focus.pomodoroSkip', title: '跳过当前阶段', group: '专注', icon: 'lucide:skip-forward', run: () => pomo.skip() },
    { id: 'focus.pomodoroReset', title: '重置番茄钟', group: '专注', icon: 'lucide:rotate-ccw', run: () => pomo.reset() },
    { id: 'focus.enter', title: '进入专注模式（含番茄钟）', group: '专注', icon: 'lucide:focus', run: () => ui.setFocusMode(true) },
    { id: 'focus.exit', title: '退出专注模式', group: '专注', icon: 'lucide:log-out', run: () => ui.setFocusMode(false) },

    // 帮助
    { id: 'help.shortcuts', title: '显示键盘快捷键', group: '帮助', icon: 'lucide:keyboard', run: () => window.dispatchEvent(new CustomEvent('markwright:show-shortcuts')) },
    { id: 'help.about', title: '关于 MarkWright', group: '帮助', icon: 'lucide:info', run: () => theme.openSettings() },

    // 全局
    { id: 'global.palette', title: '显示所有命令', group: '全局', shortcut: 'Ctrl+Shift+P', icon: 'lucide:command', run: () => cmds.openPalette() },
    { id: 'global.settings', title: '打开设置', group: '全局', shortcut: 'Ctrl+,', icon: 'lucide:settings', run: () => theme.openSettings() },

    // 模板 / 白噪音
    { id: 'template.open', title: '插入日记模板', group: '模板', shortcut: 'Ctrl+J', icon: 'lucide:layout-template', run: () => useTemplatesStore().open() },
    { id: 'whitenoise.toggle', title: '白噪音（环境音）', group: '专注', shortcut: 'Ctrl+Shift+N', icon: 'lucide:volume-2', run: () => {
      const wn = useWhiteNoise()
      wn.start(wn.current.value === 'none' ? 'rain' : 'none')
    } },
  ]

  onMounted(() => {
    cmds.registerAll(list)
    window.addEventListener('keydown', onKey as unknown as EventListener)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey as unknown as EventListener)
  })

  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    const inEditor = !!target?.closest('.cm-editor')
    const inCmdPalette = !!target?.closest('.cmd-palette')

    // 找匹配的 command
    const cmd = cmds.commands.find((c) => c.shortcut && matchShortcut(e, c.shortcut))
    if (!cmd) return

    // 编辑器内 B/I/K 等格式化快捷键不拦截（由 CodeMirror 自身处理）
    if (inEditor && /^(Mod-)?(b|i|k)$/i.test(cmd.id.replace('edit.', ''))) {
      return
    }
    // 命令面板打开时不重复触发自己的快捷键
    if (inCmdPalette) return

    e.preventDefault()
    cmd.run()
  }

  return { cmds }
}
