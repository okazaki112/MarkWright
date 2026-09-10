/**
 * 命令注册表 - 命令面板与全局快捷键共用
 *
 * 用法：
 *   const cmds = useCommands()
 *   cmds.execute('file.save')
 *   cmds.open()  // 打开命令面板
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Command {
  id: string
  title: string
  group: string
  shortcut?: string
  icon?: string
  hint?: string
  when?: () => boolean
  run: () => void | Promise<void>
}

export const useCommandStore = defineStore('commands', () => {
  const paletteOpen = ref(false)
  const searchOpen = ref(false)
  const jumpLineOpen = ref(false)
  const quickOpenOpen = ref(false)
  const commands = ref<Command[]>([])

  function register(cmd: Command) {
    const idx = commands.value.findIndex((c) => c.id === cmd.id)
    if (idx >= 0) commands.value[idx] = cmd
    else commands.value.push(cmd)
  }

  function registerAll(list: Command[]) {
    for (const c of list) register(c)
  }

  function execute(id: string) {
    const cmd = commands.value.find((c) => c.id === id)
    if (!cmd) return
    if (cmd.when && !cmd.when()) return
    cmd.run()
  }

  function openPalette() { paletteOpen.value = true }
  function closePalette() { paletteOpen.value = false }
  function openSearch() { searchOpen.value = true }
  function closeSearch() { searchOpen.value = false }
  function openJumpLine() { jumpLineOpen.value = true }
  function closeJumpLine() { jumpLineOpen.value = false }
  function openQuickOpen() { quickOpenOpen.value = true }
  function closeQuickOpen() { quickOpenOpen.value = false }

  /** 过滤后的命令列表（用于命令面板） */
  const filtered = (query: string) => {
    if (!query) return commands.value
    const q = query.toLowerCase()
    return commands.value.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q)
    )
  }

  return {
    paletteOpen,
    searchOpen,
    jumpLineOpen,
    quickOpenOpen,
    commands,
    register,
    registerAll,
    execute,
    openPalette,
    closePalette,
    openSearch,
    closeSearch,
    openJumpLine,
    closeJumpLine,
    openQuickOpen,
    closeQuickOpen,
    filtered,
  }
})
