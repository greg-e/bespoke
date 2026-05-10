<template>
  <section class="calendar-view">
    <header class="page-head">
      <h1>Calendar</h1>
    </header>

    <article class="panel">
      <form class="add-form" @submit.prevent="handleAdd">
        <input v-model="newTitle" placeholder="Event title..." required />
        <input v-model="newStart" type="datetime-local" required />
        <input v-model="newEnd" type="datetime-local" />
        <input v-model="newNotes" placeholder="Notes (optional)" />
        <button type="submit">Add</button>
      </form>

      <p v-if="store.error" class="error">{{ store.error }}</p>
      <p v-if="store.loading">Loading...</p>

      <div v-else class="view-controls">
        <div class="mode-toggle">
          <button :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">List</button>
          <button :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">Month</button>
        </div>

        <div v-if="viewMode === 'month'" class="month-nav">
          <button @click="shiftMonth(-1)">←</button>
          <strong>{{ monthLabel }}</strong>
          <button @click="shiftMonth(1)">→</button>
        </div>
      </div>

      <ul v-if="!store.loading && viewMode === 'list'" class="event-list">
        <li v-for="event in store.events" :key="event.id" @click="openEvent(event.id)" class="event-row">
          <div class="event-time">{{ formatDateTime(event.starts_at) }}</div>
          <div class="event-body">
            <strong>{{ event.title }}</strong>
            <p v-if="event.notes" class="notes">{{ event.notes }}</p>
          </div>
          <button class="delete" @click.stop="handleDeleteEvent(event)">✕</button>
        </li>
      </ul>

      <div v-else-if="!store.loading && viewMode === 'month'" class="month-grid-wrap">
        <div class="weekday-row">
          <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
        </div>

        <div class="month-grid">
          <div
            v-for="day in calendarDays"
            :key="day.key"
            class="day-cell"
            :class="{ muted: !day.inCurrentMonth, today: day.isToday }"
          >
            <div class="day-number">{{ day.date.getDate() }}</div>

            <ul class="day-events" v-if="day.events.length">
              <li v-for="event in day.events.slice(0, 3)" :key="event.id">
                <button class="day-event" @click="openEvent(event.id)">
                  {{ event.title }}
                </button>
              </li>
              <li v-if="day.events.length > 3" class="more-events">+{{ day.events.length - 3 }} more</li>
            </ul>
          </div>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCalendarStore } from '../stores/calendar'

const store = useCalendarStore()
const router = useRouter()
const newTitle = ref('')
const newStart = ref('')
const newEnd = ref('')
const newNotes = ref('')
const viewMode = ref('list')
const currentMonth = ref(startOfMonth(new Date()))
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

onMounted(() => store.fetchEvents())

const eventsByDate = computed(() => {
  const map = new Map()

  for (const event of store.events) {
    const parsed = new Date(event.starts_at)
    if (Number.isNaN(parsed.getTime())) continue

    const key = toDateKey(parsed)
    if (!map.has(key)) {
      map.set(key, [])
    }

    map.get(key).push(event)
  }

  for (const [, values] of map) {
    values.sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at))
  }

  return map
})

const monthLabel = computed(() => {
  return currentMonth.value.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })
})

const calendarDays = computed(() => {
  const monthStart = startOfMonth(currentMonth.value)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  const todayKey = toDateKey(new Date())
  const days = []

  for (let index = 0; index < 42; index += 1) {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)

    const key = toDateKey(day)
    days.push({
      key,
      date: day,
      inCurrentMonth: day.getMonth() === monthStart.getMonth(),
      isToday: key === todayKey,
      events: eventsByDate.value.get(key) ?? [],
    })
  }

  return days
})

async function handleAdd() {
  await store.addEvent(newTitle.value, newStart.value, newEnd.value || null, newNotes.value || null)
  newTitle.value = ''
  newStart.value = ''
  newEnd.value = ''
  newNotes.value = ''
}

function openEvent(id) {
  router.push(`/event/${id}`)
}

async function handleDeleteEvent(event) {
  if (!confirm(`Delete "${event.title}"?`)) return
  await store.deleteEvent(event.id)
}

function shiftMonth(delta) {
  const next = new Date(currentMonth.value)
  next.setMonth(next.getMonth() + delta)
  currentMonth.value = startOfMonth(next)
}

function startOfMonth(date) {
  const value = new Date(date)
  value.setDate(1)
  value.setHours(0, 0, 0, 0)
  return value
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateTime(dt) {
  const parsed = new Date(dt)
  if (Number.isNaN(parsed.getTime())) return dt

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.calendar-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
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

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
}

.view-controls {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.mode-toggle,
.month-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.mode-toggle button,
.month-nav button {
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 7px 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
  font-weight: 600;
}

.mode-toggle button.active {
  background: color-mix(in srgb, var(--accent) 14%, var(--panel-bg));
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.add-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.add-form input {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel-bg);
  color: var(--text-strong);
  min-width: 0;
}

.add-form input:first-child,
.add-form input:nth-child(4) {
  grid-column: 1 / -1;
}

.add-form button {
  grid-column: 1 / -1;
  border: 0;
  border-radius: 12px;
  padding: 11px 14px;
  background: var(--accent);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.event-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.month-grid-wrap {
  margin-top: 16px;
  overflow-x: auto;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  min-width: 700px;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.8rem;
  color: var(--muted);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  min-width: 700px;
  gap: 8px;
}

.day-cell {
  min-height: 120px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel-bg);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.day-cell.muted {
  opacity: 0.55;
}

.day-cell.today {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 12%, transparent);
}

.day-number {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-strong);
}

.day-events {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.day-event {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-strong);
  font-size: 0.75rem;
  text-align: left;
  padding: 4px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-events {
  font-size: 0.75rem;
  color: var(--muted);
}

.event-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.event-row:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent);
}

.event-time {
  font-size: 0.85rem;
  color: var(--muted);
  min-width: 140px;
  flex-shrink: 0;
}

.event-body {
  flex: 1;
  min-width: 0;
}

.notes {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 4px;
}

.delete {
  border: 0;
  border-radius: 12px;
  padding: 6px 10px;
  background: var(--accent);
  color: white;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.error {
  color: #ef4444;
}

@media (max-width: 720px) {
  .page-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .add-form {
    grid-template-columns: 1fr;
  }

  .view-controls {
    flex-direction: column;
    align-items: flex-start;
  }

  .add-form input:first-child,
  .add-form input:nth-child(4) {
    grid-column: 1;
  }

  .event-time {
    min-width: 0;
  }
}
</style>
