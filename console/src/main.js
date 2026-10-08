import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// The production console's stack, same versions: Bootstrap 5.3.8 for layout
// utilities and components, Font Awesome 7 for icons, then the i365 design
// layer on top. Order matters — i365 overrides Bootstrap, never the reverse.
import 'bootstrap/dist/css/bootstrap.min.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './assets/i365.css'
import './assets/app.css'
import './assets/portal.css'
import { restorePortalSession } from './lib/portal-session.js'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

// a portal sign-in lives in sessionStorage; pick it up before the first route
restorePortalSession()

createApp(App).use(createPinia()).use(router).mount('#app')
