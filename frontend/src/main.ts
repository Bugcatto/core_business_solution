import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar, Notify, Loading, Dialog } from 'quasar'

// Quasar icon + style imports
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'

import App from './App.vue'
import router from './router'
import i18n from './boot/i18n'

const app = createApp(App)

// ── Pinia ────────────────────────────────────────────────────────────────
const pinia = createPinia()
app.use(pinia)

// ── Quasar ───────────────────────────────────────────────────────────────
app.use(Quasar, {
  plugins: { Notify, Loading, Dialog },
  config: {
    notify: {
      position: 'top-right',
      timeout: 3000,
    },
  },
})

// ── i18n ─────────────────────────────────────────────────────────────────
app.use(i18n)

// ── Router ───────────────────────────────────────────────────────────────
app.use(router)

// ── Mount immediately; router guard handles auth state ───────────────────
app.mount('#app')
