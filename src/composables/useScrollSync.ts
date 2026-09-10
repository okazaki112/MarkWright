/**
 * 编辑器 ↔ 预览 滚动同步
 * - 编辑器滚动时：按比例推算预览位置
 * - 预览滚动时：根据锚点反推编辑器行
 */
import type { EditorView } from '@codemirror/view'
import { nextTick } from 'vue'

interface Options {
  getEditor: () => EditorView | null
  getPreview: () => HTMLElement | null
  enabled: () => boolean
}

let inProgress = false

export function useScrollSync(opts: Options) {
  function onEditorScroll() {
    if (!opts.enabled() || inProgress) return
    const view = opts.getEditor()
    const pane = opts.getPreview()
    if (!view || !pane) return
    const scroller = view.scrollDOM
    const total = scroller.scrollHeight - scroller.clientHeight
    if (total <= 0) return
    const ratio = scroller.scrollTop / total
    inProgress = true
    const target = (pane.scrollHeight - pane.clientHeight) * ratio
    pane.scrollTo({ top: target, behavior: 'auto' })
    requestAnimationFrame(() => { inProgress = false })
  }

  function onPreviewScroll() {
    if (!opts.enabled() || inProgress) return
    const view = opts.getEditor()
    const pane = opts.getPreview()
    if (!view || !pane) return
    const total = pane.scrollHeight - pane.clientHeight
    if (total <= 0) return
    const ratio = pane.scrollTop / total
    inProgress = true
    const scroller = view.scrollDOM
    const target = (scroller.scrollHeight - scroller.clientHeight) * ratio
    scroller.scrollTo({ top: target, behavior: 'auto' })
    requestAnimationFrame(() => { inProgress = false })
  }

  function attach() {
    nextTick(() => {
      const view = opts.getEditor()
      const pane = opts.getPreview()
      if (!view || !pane) return
      view.scrollDOM.addEventListener('scroll', onEditorScroll, { passive: true })
      pane.addEventListener('scroll', onPreviewScroll, { passive: true })
    })
  }

  function detach() {
    const view = opts.getEditor()
    const pane = opts.getPreview()
    if (view) view.scrollDOM.removeEventListener('scroll', onEditorScroll)
    if (pane) pane.removeEventListener('scroll', onPreviewScroll)
  }

  return { attach, detach }
}
