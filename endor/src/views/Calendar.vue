<template>
  <section class="calendar-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">Calendar</p>
        <h2>Events and shared projects</h2>
      </div>
      <p class="muted">Events can later hold tasks, notes, checklist items, comments, and attachments.</p>
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

      <ul v-else class="event-list">
        <li v-for="event in store.events" :key="event.id">
          <div class="event-time">{{ formatDateTime(event.starts_at) }}</div>
          <div class="event-body">
            <strong>{{ event.title }}</strong>
            <p v-if="event.notes" class="notes">{{ event.notes }}</p>
          </div>
          <button class="delete" @click="store.deleteEvent(event.id)">✕</button>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCalendarStore } from '../stores/calendar'

const store = useCalendarStore()
const newTitle = ref('')
const newStart = ref('')
const newEnd = ref('')
const newNotes = ref('')

onMounted(() => store.fetchEvents())

async function handleAdd() {
  await store.addEvent(newTitle.value, newStart.value, newEnd.value || null, newNotes.value || null)
  newTitle.value = ''
  newStart.value = ''
  newEnd.value = ''
  newNotes.value = ''
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

.add-form {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 2fr auto;
  gap: 10px;
}

.add-form input {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel-bg);
  color: var(--text-strong);
}

.add-form button,
.delete {
  border: 0;
  border-radius: 12px;
  padding: 11px 14px;
  background: var(--accent);
  color: white;
  font-weight: 700;
}

.event-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-list li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--border);
}

.event-time {
  font-size: 0.85rem;
  color: var(--muted);
  min-width: 140px;
}

.event-body {
  flex: 1;
}

.notes {
  font-size: 0.85rem;
  color: var(--muted);
  margin-top: 4px;
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
}
</style>
