<script setup>
import { ref, computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useDashboardStore } from '../stores/dashboard'
import { useSessionStore } from '../stores/session'

const dashboard = useDashboardStore()
const session = useSessionStore()

// Get current week - for now showing next 7 days
const currentDate = ref(new Date())
const weekDays = computed(() => {
  const days = []
  const start = new Date(currentDate.value)
  start.setDate(start.getDate() - start.getDay())
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    days.push(date)
  }
  return days
})

const formatDay = (date) => {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
}

const formatDayName = (date) => {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

const getDayEvents = (date) => {
  const dateStr = date.toISOString().split('T')[0]
  return dashboard.events.filter(event => {
    const eventDate = new Date(event.starts_at).toISOString().split('T')[0]
    return eventDate === dateStr
  })
}

const getEventCount = (date) => {
  return getDayEvents(date).length
}

const goToPreviousWeek = () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() - 7)
  currentDate.value = newDate
}

const goToNextWeek = () => {
  const newDate = new Date(currentDate.value)
  newDate.setDate(newDate.getDate() + 7)
  currentDate.value = newDate
}

const goToToday = () => {
  currentDate.value = new Date()
}
</script>

<template>
  <div class="week-view">
    <header class="week-header">
      <div class="week-title">
        <h1>GATHER '26</h1>
        <p class="week-subtitle">36 Days to go</p>
      </div>
      
      <div class="week-controls">
        <button class="nav-btn" @click="goToPreviousWeek">← Previous</button>
        <button class="nav-btn primary" @click="goToToday">Today</button>
        <button class="nav-btn" @click="goToNextWeek">Next →</button>
      </div>
    </header>

    <nav class="week-nav">
      <RouterLink to="/tasks" class="nav-link">Tasks</RouterLink>
      <RouterLink to="/settings" class="nav-link">Settings</RouterLink>
    </nav>

    <main class="week-grid">
      <div 
        v-for="day in weekDays"
        :key="day.toISOString()"
        class="day-card"
      >
        <RouterLink :to="`/day/${day.toISOString().split('T')[0]}`" class="day-card-link">
          <div class="day-header">
            <div class="day-name">{{ formatDayName(day) }}</div>
            <div class="day-date">{{ formatDay(day) }}</div>
          </div>
          <div class="day-content">
            <div class="event-count">
              <span class="count-number">{{ getEventCount(day) }}</span>
              <span class="count-label">{{ getEventCount(day) === 1 ? 'event' : 'events' }}</span>
            </div>
          </div>
        </RouterLink>
      </div>
    </main>
  </div>
</template>

<style scoped>
.week-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem 1rem;
  min-height: 100vh;
}

.week-header {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.week-title {
  text-align: center;
}

.week-title h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-strong);
}

.week-subtitle {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0.5rem 0 0 0;
}

.week-controls {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.nav-btn {
  padding: 0.5rem 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-btn:hover {
  background: var(--panel-bg);
  border-color: var(--accent);
}

.nav-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}

.nav-btn.primary:hover {
  opacity: 0.9;
}

.week-nav {
  display: flex;
  gap: 1rem;
  justify-content: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border);
}

.nav-link {
  padding: 0.5rem 1rem;
  color: var(--muted);
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: var(--accent);
}

.week-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  flex: 1;
}

.day-card {
  display: block;
  min-height: 120px;
}

.day-card-link {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.25rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
}

.day-card-link:hover {
  background: var(--panel-bg);
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-soft);
}

.day-header {
  margin-bottom: 1rem;
}

.day-name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-strong);
}

.day-date {
  font-size: 0.875rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.day-content {
  display: flex;
  align-items: flex-end;
  flex: 1;
}

.event-count {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.count-number {
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent);
}

.count-label {
  font-size: 0.875rem;
  color: var(--muted);
}

/* Tablet & Desktop */
@media (min-width: 768px) {
  .week-view {
    padding: 2rem;
  }

  .week-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .week-header {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .week-title {
    text-align: left;
  }

  .week-title h1 {
    font-size: 2.5rem;
  }

  .week-controls {
    justify-content: flex-end;
  }
}

@media (min-width: 1024px) {
  .week-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
