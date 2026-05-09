import { defineStore } from 'pinia'
import { useSessionStore } from './session'
import { createTask, deleteTask as removeTask, listTasks, toggleTaskStatus } from '../lib/tasks'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetchTasks() {
      this.loading = true

      try {
        this.tasks = await listTasks()
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
    async addTask(title, dueDate = null) {
      const session = useSessionStore()
      const userId = session.user?.id

      if (!userId) {
        this.error = 'Sign in first to create tasks.'
        return
      }

      this.loading = true

      try {
        const createdTask = await createTask({
          title,
          due_date: dueDate,
          created_by: userId,
        })

        this.tasks.unshift(createdTask)
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
    async toggleTask(task) {
      try {
        const updatedTask = await toggleTaskStatus(task.id, task.status === 'done' ? 'not_started' : 'done')
        Object.assign(task, updatedTask)
      } catch (error) {
        this.error = error?.message ?? String(error)
      }
    },
    async deleteTask(id) {
      try {
        await removeTask(id)
        this.tasks = this.tasks.filter((task) => task.id !== id)
      } catch (error) {
        this.error = error?.message ?? String(error)
      }
    },
  },
})
