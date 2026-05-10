<template>
  <section class="today-view">
    <header class="hero">
      <h1>Today</h1>

      <div class="hero-actions">
        <router-link class="primary cta-link" to="/tasks">+ Add task</router-link>
        <button class="secondary" type="button" @click="refresh">Refresh</button>
      </div>
    </header>

    <article v-if="dashboard.error" class="panel alert">
      <div>
        <p class="eyebrow">Data connection</p>
        <h2>Supabase data is not ready yet</h2>
        <p class="muted">{{ dataConnectionGuidance }}</p>
      </div>
      <pre class="error-box">{{ dashboard.error }}</pre>
    </article>

    <div class="dashboard-grid">
      <article class="panel">
        <div class="panel-head">
          <h2>Suggested Top {{ selectedCapacity }}</h2>
          <div class="panel-head-actions">
            <label class="capacity-control">
              <span>Capacity</span>
              <input
                v-model.number="selectedCapacity"
                type="range"
                :min="capacityMin"
                :max="capacityMax"
                step="1"
                aria-label="Capacity"
              />
              <strong class="capacity-value">{{ selectedCapacity }}</strong>
            </label>
            <span class="pill">{{ displayedSuggestedTasks.length }}/{{ dashboard.suggestedTasks.length }}</span>
          </div>
        </div>

        <p v-if="dashboard.loading">Loading suggestions...</p>
        <p v-else-if="!displayedSuggestedTasks.length" class="muted">No suggestions yet.</p>

        <ul v-else class="list-card">
          <li v-for="task in displayedSuggestedTasks" :key="task.id">
            <div>
              <strong>{{ task.title }}</strong>
              <p class="muted small">{{ task.reasons.join(' · ') || 'Suggested from your work' }}</p>
            </div>
            <div class="suggestion-actions">
              <span class="pill" v-if="task.duration_minutes">{{ task.duration_minutes }}m</span>
              <button class="chip-action" type="button" @click="setTaskStatus(task, 'in_progress')">Start</button>
              <button class="chip-action" type="button" @click="setTaskStatus(task, 'done')">Done</button>
              <button class="chip-action" type="button" @click="togglePinned(task)">
                {{ task.is_pinned ? 'Unpin' : 'Pin' }}
              </button>
              <router-link class="chip-link" :to="`/task/${task.id}`">Open</router-link>
            </div>
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
            <div class="suggestion-actions">
              <span class="pill">{{ formatTaskStatus(task.status) }}</span>
              <button class="chip-action" type="button" @click="setTaskStatus(task, 'in_progress')">Start</button>
              <button class="chip-action" type="button" @click="setTaskStatus(task, 'done')">Done</button>
              <router-link class="chip-link" :to="`/task/${task.id}`">Open</router-link>
            </div>
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
            <div class="suggestion-actions">
              <span class="pill" v-if="event.is_shared">Shared</span>
              <router-link class="chip-link" :to="`/event/${event.id}`">Open event</router-link>
            </div>
          </li>
        </ul>
        <p v-else class="muted">No events scheduled for today.</p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useDashboardStore } from '../stores/dashboard'
import { pinTask, toggleTaskStatus } from '../lib/tasks'

const TODAY_CAPACITY_KEY = 'endor_today_capacity_v1'
const capacityMin = 1
const capacityMax = 6

const dashboard = useDashboardStore()

const { tasks } = storeToRefs(dashboard)
const selectedCapacity = ref(readCapacityPreference())

const openTasks = computed(() => tasks.value.filter((task) => task.status !== 'done'))
const openTaskCount = computed(() => openTasks.value.length)
const displayedSuggestedTasks = computed(() => dashboard.suggestedTasks.slice(0, selectedCapacity.value))
const dataConnectionGuidance = computed(() => {
  const normalized = String(dashboard.error ?? '').toLowerCase()

  if (normalized.includes('does not exist') || normalized.includes('relation') || normalized.includes('schema')) {
    return 'Apply supabase/migrations/20260509000000_initial_schema.sql in Supabase, then refresh the page.'
  }

  return 'We could not load today data. Check your network/auth connection and try Refresh.'
})

watch(selectedCapacity, (value) => {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(TODAY_CAPACITY_KEY, String(value))
})

function readCapacityPreference() {
  if (typeof window === 'undefined') return 3

  const raw = window.localStorage.getItem(TODAY_CAPACITY_KEY)
  const parsed = Number.parseInt(raw ?? '', 10)

  if (Number.isNaN(parsed) || parsed < capacityMin || parsed > capacityMax) return 3

  return parsed
}

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

function formatTaskStatus(status) {
  if (status === 'not_started') return 'Not started'
  if (status === 'in_progress') return 'In progress'
  if (status === 'done') return 'Done'
  return status
}

async function refresh() {
  await dashboard.refresh()
}

async function togglePinned(task) {
  try {
    await pinTask(task.id, !task.is_pinned)
    await refresh()
  } catch (error) {
    dashboard.error = error?.message ?? String(error)
  }
}

async function setTaskStatus(task, status) {
  try {
    await toggleTaskStatus(task.id, status)
    await refresh()
  } catch (error) {
    dashboard.error = error?.message ?? String(error)
  }
}

onMounted(async () => {
  await refresh()
})
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

.hero-actions {
  display: flex;
  gap: 10px;
  align-items: center;
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

.microsoft-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.microsoft-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.account-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 14px;
  background: var(--panel-bg);
}

.account-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.account-actions {
  display: flex;
  gap: 8px;
}

.preferences-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preferences-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pref-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 10px;
  align-items: center;
}

.toggle-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pref-row input[type='time'],
.pref-row input[type='number'] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
}

.pref-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  border-radius: 999px;
  padding: 10px 14px;
  font-weight: 700;
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

.cta-link {
  text-decoration: none;
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

.panel-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.capacity-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.85rem;
}

.capacity-control input[type='range'] {
  width: 120px;
  accent-color: var(--accent);
}

.capacity-value {
  min-width: 1ch;
  color: var(--text-strong);
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

.list-card.compact li {
  padding: 10px;
}

      .suggestion-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .chip-action {
        border: 1px solid var(--border);
        background: var(--panel-bg);
        color: var(--text-strong);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
      }

.chip-link {
  border: 1px solid var(--border);
  background: var(--panel-bg);
  color: var(--text-strong);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
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

  .panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .microsoft-grid {
    grid-template-columns: 1fr;
  }

  .pref-row {
    grid-template-columns: 1fr;
  }

  .pref-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
