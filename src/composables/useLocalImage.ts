/**
 * 本地图片路径解析（纯函数，便于单测）
 *
 * Markdown 里的图片 src 经过 markdown-it 归一化后，可能与真实文件路径不一致：
 *  - Windows 反斜杠被百分号编码：`C:\a\b.png` → `C:%5Ca%5Cb.png`
 *  - 空格被编码：`a b.png` → `a%20b.png`
 *  - 还可能出现 `file://` 前缀、`<...>` 包裹、`./` 前缀
 * 这里统一归一为「以 / 分隔的文件路径」，并按「文档目录 → 工作区根」生成候选路径。
 */
import { join } from '@tauri-apps/api/path'

/** Markdown 图片 src → 归一化文件路径（解码百分号转义，统一 / 分隔符） */
export function normalizeImageSrc(raw: string): string {
  let s = (raw ?? '').trim()
  // markdown 允许 ![alt](<url with space>) 形式
  if (s.startsWith('<') && s.endsWith('>')) s = s.slice(1, -1).trim()
  // 去掉可能的引号包裹
  s = s.replace(/^["']|["']$/g, '')
  // file:// URL → 本地路径（/C:/x → C:/x）
  if (/^file:\/\//i.test(s)) {
    s = s.replace(/^file:\/\//i, '').replace(/^\/([a-zA-Z]:)/, '$1')
  }
  try {
    s = decodeURIComponent(s)
  } catch {
    // 含非法 % 序列（例如真实文件名里就有 %）时保留原样
  }
  return s.replace(/\\/g, '/')
}

/** 是否绝对路径：Windows 盘符 / UNC / POSIX */
export function isAbsoluteImagePath(p: string): boolean {
  return /^[a-zA-Z]:\//.test(p) || p.startsWith('//') || p.startsWith('/')
}

/**
 * 生成候选绝对路径：
 *  - 绝对路径：原样返回
 *  - 相对路径：按 [文档所在目录, 工作区根目录] 顺序回退
 *    （历史版本把图片归档到工作区根 assets/，文档位于子目录时靠第二条命中）
 */
export async function buildImageCandidates(
  src: string,
  docDir: string | null,
  workspaceRoot: string | null,
): Promise<string[]> {
  const decoded = normalizeImageSrc(src)
  if (!decoded) return []
  if (isAbsoluteImagePath(decoded)) return [decoded]
  const rel = decoded.replace(/^\.\//, '')
  const out: string[] = []
  for (const base of [docDir, workspaceRoot]) {
    if (!base) continue
    const full = await join(base, rel)
    if (!out.includes(full)) out.push(full)
  }
  return out
}
