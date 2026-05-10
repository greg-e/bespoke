import { defineStore } from 'pinia'
import { loadTodayDashboard } from '../lib/dashboard'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loading: false,
    error: null,
    tasks: [],
    events: [],
    suggestedTasks: [],
  }),
  actions: {
    async refresh() {
      this.loading = true
      this.error = null

      try {
        const data = await loadTodayDashboard({ suggestionLimit: 12 })
        this.tasks = data.tasks
        this.events = data.events
        this.suggestedTasks = data.suggestedTasks
        this.error = null
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
  },
})
