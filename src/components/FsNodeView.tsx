/**
 * 文件树节点子组件（递归）
 * 单独抽出避免 <script setup> 与 <script> 双声明冲突
 */
import { defineComponent, h, type PropType } from 'vue'
import { Icon } from '@iconify/vue'
import type { FsNode } from '../stores/workspace'

export const FsNodeView = defineComponent({
  name: 'FsNodeView',
  props: {
    node: { type: Object as PropType<FsNode>, required: true },
    depth: { type: Number, default: 0 },
  },
  emits: ['open', 'create', 'ctx'],
  setup(props, { emit }) {
    return (): ReturnType<typeof h> => {
      const n = props.node
      const isFile = !n.isDir
      return h('div', { class: 'tnode-wrap' }, [
        h(
          'div',
          {
            class: ['tnode', { dir: n.isDir, file: isFile, active: false }],
            style: { paddingLeft: 8 + props.depth * 12 + 'px' },
            onClick: () => emit('open', n),
            onContextmenu: (e: MouseEvent) => emit('ctx', e, n),
          },
          [
            n.isDir
              ? h(Icon, { icon: n.expanded ? 'lucide:chevron-down' : 'lucide:chevron-right' })
              : h('span', { class: 'bullet' }),
            h(Icon, { icon: isFile ? 'lucide:file-text' : 'lucide:folder' }),
            h('span', { class: 'label', title: n.name }, n.name),
            n.isDir
              ? h('div', { class: 'tnode-actions' }, [
                  h(
                    'button',
                    {
                      class: 'iconbtn',
                      title: '新建文件',
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        emit('create', n.path, 'file')
                      },
                    },
                    [h(Icon, { icon: 'lucide:file-plus' })]
                  ),
                ])
              : null,
          ]
        ),
        n.isDir && n.expanded && n.children
          ? h(
              'ul',
              { class: 'tlist' },
              n.children.map((c) =>
                h(FsNodeView, {
                  node: c,
                  depth: props.depth + 1,
                  onOpen: (node: FsNode) => emit('open', node),
                  onCreate: (parent: string, type: 'file' | 'dir') => emit('create', parent, type),
                  onCtx: (e: MouseEvent, node: FsNode) => emit('ctx', e, node),
                })
              )
            )
          : null,
      ])
    }
  },
})
