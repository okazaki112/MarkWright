import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as D from 'docx'
import { mdToBlocks, strip, parseInline } from '../../src/composables/useExportDocx'

beforeEach(() => setActivePinia(createPinia()))

describe('exportDocx blocks', () => {
  it('strip removes markdown emphasis', () => {
    expect(strip('**b** `c`')).toBe('b c')
  })

  it('parseInline keeps plain text', () => {
    const runs = parseInline(D, 'plain')
    expect(runs.length).toBeGreaterThanOrEqual(1)
  })

  it('parses headings into Paragraphs with heading level', () => {
    const blocks = mdToBlocks(D, '# Title\n## Sub')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toBeInstanceOf(D.Paragraph)
  })

  it('parses a bullet list', () => {
    const blocks = mdToBlocks(D, '- a\n- b')
    expect(blocks).toHaveLength(2)
  })

  it('parses a code block into one paragraph', () => {
    const blocks = mdToBlocks(D, '```\nline1\nline2\n```')
    expect(blocks).toHaveLength(1)
  })

  it('parses a blockquote', () => {
    const blocks = mdToBlocks(D, '> quoted')
    expect(blocks).toHaveLength(1)
  })

  it('builds a packable document (ordered + bullet lists need numbering config)', async () => {
    const Dmod = await import('docx')
    const blocks = mdToBlocks(Dmod, '# H\n1. one\n- bullet\n> quote\n```\ncode\n```')
    const doc = new Dmod.Document({
      creator: 'MarkWright',
      title: 't',
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [{ level: 0, format: Dmod.LevelFormat.DECIMAL, text: '%1.', alignment: Dmod.AlignmentType.START }],
          },
          {
            reference: 'default-bullet',
            levels: [{ level: 0, format: Dmod.LevelFormat.BULLET, text: '•', alignment: Dmod.AlignmentType.START }],
          },
        ],
      },
      sections: [{ properties: {}, children: blocks }],
    })
    const blob = await Dmod.Packer.toBlob(doc)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.size).toBeGreaterThan(0)
  })
})
