import { defineStore } from 'pinia'
import { getCurrentUser, getSession, onAuthStateChange, signInWithMagicLink, signOut } from '../lib/auth'

export const useSessionStore = defineStore('session', {
  state: () => ({
    session: null,
    user: null,
    loading: false,
    error: null,
    ready: false,
    unsubscribe: null,
  }),
  actions: {
    async bootstrap() {
      this.loading = true
      this.error = null

      try {
        this.session = await getSession()
        this.user = this.session?.user ?? (await getCurrentUser()) ?? null
      } catch (error) {
        const message = error?.message ?? String(error)

        if (!/session missing/i.test(message)) {
          this.error = message
        }

        this.session = null
        this.user = null
      } finally {
        this.loading = false
        this.ready = true
      }

      this.unsubscribe?.()
      const { data } = onAuthStateChange((_event, session) => {
        this.session = session
        this.user = session?.user ?? null
      })

      this.unsubscribe = data.subscription?.unsubscribe ?? null
    },
    async emailSignIn(email) {
      this.loading = true
      this.error = null

      try {
        await signInWithMagicLink(email)
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
    async logout() {
      this.loading = true
      this.error = null

      try {
        await signOut()
        this.session = null
        this.user = null
      } catch (error) {
        this.error = error?.message ?? String(error)
      } finally {
        this.loading = false
      }
    },
  },
})
