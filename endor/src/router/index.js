import { createRouter, createWebHistory } from 'vue-router'
import Today from '../views/Today.vue'
import Tasks from '../views/Tasks.vue'
import Calendar from '../views/Calendar.vue'

const routes = [
  { path: '/', redirect: '/today' },
  { path: '/today', component: Today },
  { path: '/tasks', component: Tasks },
  { path: '/calendar', component: Calendar },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
