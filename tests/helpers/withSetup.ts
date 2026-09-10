import { createApp, defineComponent, h, type App } from 'vue'

/**
 * 在最小 Vue 应用上下文中运行一个 composable，
 * 使 onMounted/onBeforeUnmount 等生命周期钩子能正确注册。
 */
export function withSetup<T>(composable: () => T): { result: T; app: App } {
  let result!: T
  const app = createApp(
    defineComponent({
      setup() {
        result = composable()
        return () => h('div')
      },
    }),
  )
  app.mount(document.createElement('div'))
  return { result, app }
}
