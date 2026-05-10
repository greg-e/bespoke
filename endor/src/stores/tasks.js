import { defineStore } from 'pinia'
import { useSessionStore } from './session'
import { createTask, deleteTask as removeTask, listTasks, toggleTaskStatus, updateTask as patchTask } from '../lib/tasks'

export const useTaskStore = defineStore('tasks', {
  state: () => ({
    tasks: [],
    loading: false,
    error: null,
  }),
  actions: {
    async fetchTasks() {
      this.loading = true
      this.error = null

      try {
        this.tasks = await listTasks()
        this.error = null
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
    async addTask(title, dueDate = null) {
      const session = useSessionStore()
      const userId = session.user?.id
      this.error = null

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
        this.error = null
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
    async toggleTask(task) {
      this.error = null
      try {
        const updatedTask = await toggleTaskStatus(task.id, task.status === 'done' ? 'not_started' : 'done')
        Object.assign(task, updatedTask)
        this.error = null
      } catch (error) {
        this.error = error?.message ?? String(error)
      }
    },
    async deleteTask(id) {
      this.error = null
      try {
        await removeTask(id)
        this.tasks = this.tasks.filter((task) => task.id !== id)
        this.error = null
      } catch (error) {
        this.error = error?.message ?? String(error)
      }
    },
    async updateTask(id, patch) {
      this.error = null
      try {
        const updatedTask = await patchTask(id, patch)
        const existingTask = this.tasks.find((task) => task.id === id)

        if (existingTask) {
          Object.assign(existingTask, updatedTask)
        }

        this.error = null

        return updatedTask
      } catch (error) {
        this.error = error?.message ?? String(error)
        throw error
      }
    },
  },
})
