/**
 * 导出 DOCX（基于 docx npm 库）
 * - 简单实现：把 markdown 转 HTML，再把 HTML 解析为段落
 * - 标题 / 列表 / 引用 / 代码 / 链接基本支持
 *
 * v0.4.8：docx（~335KB）改为按需动态加载 —— 导出是低频操作，
 * 不该拖慢应用启动，因此只在真正导出时才 import。
 */
import { save as saveDialog } from '@tauri-apps/plugin-dialog'
import { writeBytesSmart } from './useExportPng'
import type { Paragraph as DocxParagraph, TextRun as DocxTextRun } from 'docx'
import { useDocumentStore } from '../stores/document'
import { useBusyStore } from '../stores/busy'
import { useToastStore } from '../stores/toast'

type DocxModule = typeof import('docx')

let docxMod: DocxModule | null = null
async function getDocx(): Promise<DocxModule> {
  if (!docxMod) docxMod = await import('docx')
  return docxMod
}

export function strip(s: string): string {
  return s.replace(/[*_`~]+/g, '').trim()
}

export function mdToBlocks(D: DocxModule, md: string): DocxParagraph[] {
  const lines = md.split('\n')
  const out: DocxParagraph[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // 标题
    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) {
      const level = h[1].length
      out.push(
        new D.Paragraph({
          heading: level === 1 ? D.HeadingLevel.HEADING_1 :
                    level === 2 ? D.HeadingLevel.HEADING_2 :
                    level === 3 ? D.HeadingLevel.HEADING_3 :
                    level === 4 ? D.HeadingLevel.HEADING_4 :
                    D.HeadingLevel.HEADING_5,
          children: parseInline(D, strip(h[2])),
        })
      )
      i++
      continue
    }
    // 代码块
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++
      out.push(
        new D.Paragraph({
          children: codeLines.map(
            (l) =>
              new D.TextRun({
                text: l || ' ',
                font: 'Consolas',
                size: 20,
              })
          ),
          spacing: { before: 100, after: 100 },
        })
      )
      continue
    }
    // 引用
    if (line.startsWith('> ')) {
      out.push(
        new D.Paragraph({
          indent: { left: 360 },
          children: parseInline(D, strip(line.slice(2))),
        })
      )
      i++
      continue
    }
    // 无序列表
    if (line.match(/^[-*+]\s+/)) {
      out.push(
        new D.Paragraph({
          numbering: { reference: 'default-bullet', level: 0 },
          children: parseInline(D, strip(line.replace(/^[-*+]\s+/, ''))),
        })
      )
      i++
      continue
    }
    // 有序列表
    if (line.match(/^\d+\.\s+/)) {
      out.push(
        new D.Paragraph({
          numbering: { reference: 'default-numbering', level: 0 },
          children: parseInline(D, strip(line.replace(/^\d+\.\s+/, ''))),
        })
      )
      i++
      continue
    }
    // 水平线
    if (line.match(/^---+$/)) {
      out.push(new D.Paragraph({ children: [new D.TextRun({ text: '─'.repeat(40) })] }))
      i++
      continue
    }
    // 空行
    if (!line.trim()) {
      i++
      continue
    }
    // 普通段落
    out.push(new D.Paragraph({ children: parseInline(D, line) }))
    i++
  }
  return out
}

export function parseInline(D: DocxModule, text: string): DocxTextRun[] {
  const runs: DocxTextRun[] = []
  // 简化：把 ** / * / ` 处理为不同 bold/italic/code
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      runs.push(new D.TextRun({ text: text.slice(last, m.index) }))
    }
    const seg = m[0]
    if (seg.startsWith('**')) {
      runs.push(new D.TextRun({ text: strip(seg), bold: true }))
    } else if (seg.startsWith('*')) {
      runs.push(new D.TextRun({ text: strip(seg), italics: true }))
    } else if (seg.startsWith('`')) {
      runs.push(new D.TextRun({ text: strip(seg), font: 'Consolas' }))
    } else if (seg.startsWith('[')) {
      const lm = seg.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (lm) {
        runs.push(
          new D.TextRun({
            text: lm[1] + ' ',
            color: '0969da',
            underline: {},
          }),
          new D.TextRun({ text: '(' + lm[2] + ')', color: '666666', size: 18 })
        )
      }
    }
    last = m.index + seg.length
  }
  if (last < text.length) {
    runs.push(new D.TextRun({ text: text.slice(last) }))
  }
  if (runs.length === 0) runs.push(new D.TextRun({ text: '' }))
  return runs
}

export async function exportDocx(): Promise<boolean> {
  const doc = useDocumentStore()
  const busy = useBusyStore()
  const toasts = useToastStore()
  const tab = doc.activeTab
  if (!tab) return false
  const target = await saveDialog({
    title: '导出 DOCX',
    defaultPath: (tab.name || 'untitled').replace(/\.md$/, '.docx'),
    filters: [{ name: 'Word 文档', extensions: ['docx'] }],
  })
  if (!target) return false
  try {
    const D = await getDocx()
    const blocks = await busy.run('生成 DOCX…', async () => mdToBlocks(D, tab.content))
    const document = new D.Document({
      creator: 'MarkWright',
      title: tab.name,
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: D.LevelFormat.DECIMAL,
                text: '%1.',
                alignment: D.AlignmentType.START,
              },
            ],
          },
          {
            reference: 'default-bullet',
            levels: [
              {
                level: 0,
                format: D.LevelFormat.BULLET,
                text: '•',
                alignment: D.AlignmentType.START,
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {},
          children: blocks.length > 0 ? blocks : [new D.Paragraph({ children: [new D.TextRun('')] })],
        },
      ],
    })
    const blob = await busy.run('打包 DOCX…', () => D.Packer.toBlob(document))
    const buf = new Uint8Array(await blob.arrayBuffer())
    await writeBytesSmart(target, buf)
    return true
  } catch (e) {
    console.error('exportDocx failed', e)
    toasts.error('导出 DOCX 失败', String(e))
    return false
  }
}
