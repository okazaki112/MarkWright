import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

import 'katex/dist/katex.min.css'

import './styles/tokens.css'
import './styles/base.css'
import './styles/editor.css'
import './styles/preview.css'
import './styles/content-themes.css'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.mount('#app')
