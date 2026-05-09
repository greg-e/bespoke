import { defineStore } from 'pinia'
import { useSessionStore } from './session'
import { createEvent, deleteEvent as removeEvent, listEvents } from '../lib/events'

export const useCalendarStore = defineStore('calendar', {
  state: () => ({
    events: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetchEvents() {
      this.loading = true

      try {
        this.events = await listEvents()
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
    async addEvent(title, startTime, endTime = null, notes = null) {
      const session = useSessionStore()
      const userId = session.user?.id

      if (!userId) {
        this.error = 'Sign in first to create events.'
        return
      }

      this.loading = true

      try {
        const createdEvent = await createEvent({
          title,
          starts_at: startTime,
          ends_at: endTime,
          notes,
          created_by: userId,
        })

        this.events.push(createdEvent)
        this.events.sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at))
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
    async deleteEvent(id) {
      try {
        await removeEvent(id)
        this.events = this.events.filter((event) => event.id !== id)
      } catch (error) {
        this.error = error?.message ?? String(error)
      }
    },
  },
})
