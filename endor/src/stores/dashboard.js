import { defineStore } from 'pinia'
import { loadTodayDashboard } from '../lib/dashboard'
import { useSessionStore } from './session'

const DASHBOARD_CACHE_KEY = 'endor_today_dashboard_v1'

function readCachedDashboard(userId) {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(DASHBOARD_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (parsed?.userId !== userId || !parsed?.data) return null

    const tasks = Array.isArray(parsed.data.tasks) ? parsed.data.tasks : []
    const events = Array.isArray(parsed.data.events) ? parsed.data.events : []
    const suggestedTasks = Array.isArray(parsed.data.suggestedTasks) ? parsed.data.suggestedTasks : []

    return { tasks, events, suggestedTasks }
  } catch {
    return null
  }
}

function writeCachedDashboard(userId, data) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      DASHBOARD_CACHE_KEY,
      JSON.stringify({
        userId,
        data: {
          tasks: Array.isArray(data.tasks) ? data.tasks : [],
          events: Array.isArray(data.events) ? data.events : [],
          suggestedTasks: Array.isArray(data.suggestedTasks) ? data.suggestedTasks : [],
        },
      }),
    )
  } catch {
    // Ignore localStorage write failures.
  }
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false,
    error: null,
    usingCachedData: false,
    tasks: [],
    events: [],
    suggestedTasks: [],
  }),
  actions: {
    async refresh() {
      const session = useSessionStore()
      const userId = session.user?.id ?? null

      this.loading = true
      this.error = null
      this.usingCachedData = false

      try {
        const data = await loadTodayDashboard({ suggestionLimit: 12 })
        this.tasks = data.tasks
        this.events = data.events
        this.suggestedTasks = data.suggestedTasks
        writeCachedDashboard(userId, data)
        this.error = null
      } catch (error) {
        const cached = readCachedDashboard(userId)

        if (cached) {
          this.tasks = cached.tasks
          this.events = cached.events
          this.suggestedTasks = cached.suggestedTasks
          this.usingCachedData = true
          this.error = `${error?.message ?? String(error)} (showing cached data)`
        } else {
          this.error = error?.message ?? String(error)
        }
      } finally {
        this.loading = false
      }
    },
  },
})
