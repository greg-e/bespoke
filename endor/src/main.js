import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router/index.js'
import './style.css'
import App from './App.vue'
import { useSessionStore } from './stores/session'

async function bootstrap() {
	const app = createApp(App)
	const pinia = createPinia()

	app.use(pinia)
	app.use(router)

	const session = useSessionStore()
	await session.bootstrap()

	app.mount('#app')
}

bootstrap()
