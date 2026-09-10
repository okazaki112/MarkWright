declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it'
  const plugin: (md: MarkdownIt, options?: { enabled?: boolean; label?: boolean; labelAfter?: boolean }) => void
  export default plugin
}

declare module 'katex/contrib/auto-render' {
  const autoRender: (
    element: HTMLElement,
    options?: {
      delimiters?: { left: string; right: string; display: boolean }[]
      throwOnError?: boolean
    }
  ) => void
  export default autoRender
}
