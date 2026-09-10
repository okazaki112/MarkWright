/**
 * Vitest 全局 setup
 * - 为 Tauri 的 API/插件提供可覆盖的 mock（通过 globalThis.__tauri）
 * - 测试里可在 beforeEach 中给具体方法设置实现：
 *     import { getTauri } from '../tests/setup'
 *     getTauri().readTextFile.mockResolvedValue('# hello')
 */
import { vi } from 'vitest'

type AnyFn = (...args: any[]) => any

function registry(): Record<string, AnyFn> {
  const g = globalThis as any
  if (!g.__tauri) {
    g.__tauri = {
      invoke: vi.fn().mockResolvedValue(undefined),
      readDir: vi.fn().mockResolvedValue([]),
      exists: vi.fn().mockResolvedValue(false),
      mkdir: vi.fn().mockResolvedValue(undefined),
      readTextFile: vi.fn().mockResolvedValue(''),
      writeTextFile: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(null),
      ask: vi.fn().mockResolvedValue(false),
      appDataDir: vi.fn().mockResolvedValue('/tmp/appdata'),
      join: vi.fn((...p: string[]) => p.filter(Boolean).join('/')),
      dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/') || '.'),
      openPath: vi.fn().mockResolvedValue(undefined),
    }
  }
  return g.__tauri as Record<string, AnyFn>
}

export function getTauri(): Record<string, AnyFn> {
  return registry()
}

// 初始化默认注册表（在 setup 文件执行时）
registry()

const t = (name: string) => (...args: any[]) => getTauri()[name](...args)

vi.mock('@tauri-apps/api/core', () => ({
  invoke: t('invoke'),
}))
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: t('readDir'),
  exists: t('exists'),
  mkdir: t('mkdir'),
  readTextFile: t('readTextFile'),
  writeTextFile: t('writeTextFile'),
  writeFile: t('writeFile'),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: t('open'),
  save: t('save'),
  ask: t('ask'),
}))
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: t('openPath'),
}))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: t('appDataDir'),
  join: t('join'),
  dirname: t('dirname'),
}))
