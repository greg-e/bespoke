import { createRouter, createWebHistory } from 'vue-router'
import Today from '../views/Today.vue'
import Tasks from '../views/Tasks.vue'
import TaskDetail from '../views/TaskDetail.vue'
import Calendar from '../views/Calendar.vue'
import EventDetail from '../views/EventDetail.vue'
import Settings from '../views/Settings.vue'

const routes = [
  { path: '/', redirect: '/today' },
  { path: '/today', component: Today },
  { path: '/tasks', component: Tasks },
  { path: '/task/:id', component: TaskDetail },
  { path: '/calendar', component: Calendar },
  { path: '/settings', component: Settings },
  { path: '/event/:id', component: EventDetail },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
