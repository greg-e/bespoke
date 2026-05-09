<template>
  <section class="today-view">
    <header class="hero">
      <div>
        <p class="eyebrow">Today</p>
        <h1>Your focus for the day</h1>
        <p class="muted">Choose your Top 3, scan overdue work, and stay on top of event-based projects.</p>
      </div>

      <button class="primary" type="button" @click="refresh">Refresh</button>
    </header>

    <article v-if="dashboard.error" class="panel alert">
      <div>
        <p class="eyebrow">Data connection</p>
        <h2>Supabase data is not ready yet</h2>
        <p class="muted">Apply <strong>supabase/migrations/20260509000000_initial_schema.sql</strong> in Supabase, then refresh the page.</p>
      </div>
      <pre class="error-box">{{ dashboard.error }}</pre>
    </article>

    <article class="panel auth-panel">
      <div>
        <p class="eyebrow">Account</p>
        <h2>{{ session.user ? 'Signed in' : 'Sign in to sync' }}</h2>
        <p class="muted" v-if="session.user">{{ session.user.email }}</p>
        <p class="muted" v-else>Enter your email to get a magic link from Supabase Auth.</p>
        <p v-if="session.error" class="error-text">{{ session.error }}</p>
      </div>

      <form v-if="!session.user" class="auth-form" @submit.prevent="handleSignIn">
        <input v-model="email" type="email" placeholder="you@example.com" required />
        <button class="primary" type="submit">Send magic link</button>
      </form>

      <button v-else class="secondary" type="button" @click="handleSignOut">Sign out</button>
    </article>

    <div class="dashboard-grid">
      <article class="panel">
        <div class="panel-head">
          <h2>Suggested Top 3</h2>
          <span class="pill">{{ dashboard.suggestedTasks.length }} suggestions</span>
        </div>

        <p v-if="dashboard.loading">Loading suggestions...</p>
        <p v-else-if="!dashboard.suggestedTasks.length" class="muted">No suggestions yet.</p>

        <ul v-else class="list-card">
          <li v-for="task in dashboard.suggestedTasks" :key="task.id">
            <div>
              <strong>{{ task.title }}</strong>
              <p class="muted small">{{ task.reasons.join(' · ') || 'Suggested from your work' }}</p>
            </div>
            <span class="pill" v-if="task.duration_minutes">{{ task.duration_minutes }}m</span>
          </li>
        </ul>
      </article>

      <article class="panel">
        <div class="panel-head">
          <h2>Overdue & open tasks</h2>
          <span class="pill">{{ openTaskCount }}</span>
        </div>

        <ul v-if="openTasks.length" class="list-card">
          <li v-for="task in openTasks" :key="task.id">
            <div>
              <strong>{{ task.title }}</strong>
              <p class="muted small">{{ task.due_date || 'No due date' }}</p>
            </div>
            <span class="pill">{{ task.status }}</span>
          </li>
        </ul>
        <p v-else class="muted">No open tasks right now.</p>
      </article>

      <article class="panel wide">
        <div class="panel-head">
          <h2>Today’s events</h2>
          <span class="pill">{{ dashboard.events.length }}</span>
        </div>

        <ul v-if="dashboard.events.length" class="list-card timeline">
          <li v-for="event in dashboard.events" :key="event.id">
            <div>
              <strong>{{ event.title }}</strong>
              <p class="muted small">{{ formatDateTime(event.starts_at) }}</p>
            </div>
            <span class="pill" v-if="event.is_shared">Shared</span>
          </li>
        </ul>
        <p v-else class="muted">No events scheduled for today.</p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '../stores/dashboard'
import { useSessionStore } from '../stores/session'

const dashboard = useDashboardStore()
const session = useSessionStore()
const email = ref('')

const { tasks } = storeToRefs(dashboard)

const openTasks = computed(() => tasks.value.filter((task) => task.status !== 'done'))
const openTaskCount = computed(() => openTasks.value.length)

function formatDateTime(value) {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function refresh() {
  await dashboard.refresh()
}

async function handleSignIn() {
  await session.emailSignIn(email.value)
  email.value = ''
}

async function handleSignOut() {
  await session.logout()
}

onMounted(refresh)
</script>

<style scoped>
.today-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.auth-panel {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
}

.alert {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.auth-form {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: var(--accent);
  margin-bottom: 6px;
}

.muted {
  color: var(--muted);
}

.error-text {
  margin-top: 8px;
  color: #b91c1c;
}

.error-box {
  max-width: 420px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(185, 28, 28, 0.08);
  color: #7f1d1d;
  white-space: pre-wrap;
  word-break: break-word;
}

.small {
  font-size: 14px;
}

.primary {
  border: 0;
  background: var(--accent);
  color: white;
  border-radius: 999px;
  padding: 12px 18px;
  font-weight: 700;
}

.secondary {
  border: 1px solid var(--border);
  background: var(--panel-bg);
  color: var(--text-strong);
  border-radius: 999px;
  padding: 12px 18px;
  font-weight: 700;
}

.auth-form input {
  min-width: 250px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel-bg);
  color: var(--text-strong);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
}

.panel.wide {
  grid-column: 1 / -1;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 6px 10px;
  background: var(--pill-bg);
  color: var(--text-strong);
  font-size: 13px;
  font-weight: 600;
}

.list-card {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list-card li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--border);
}

.timeline li {
  align-items: flex-start;
}

@media (max-width: 860px) {
  .auth-panel,
  .hero,
  .alert {
    flex-direction: column;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
