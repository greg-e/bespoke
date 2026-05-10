<template>
  <section class="tasks-view">
    <header class="page-head">
      <h1>Tasks</h1>
    </header>

    <article class="panel">
      <form class="add-form" @submit.prevent="handleAdd">
        <input v-model="newTitle" placeholder="New task..." required />
        <input v-model="newDueDate" type="date" />
        <button type="submit">Add</button>
      </form>

      <p v-if="store.error" class="error">{{ store.error }}</p>
      <p v-if="store.loading">Loading...</p>

      <ul v-else class="task-list">
        <li
          v-for="task in store.tasks"
          :key="task.id"
          :class="{ completed: task.status === 'done' }"
          class="task-row"
          @click="openTask(task.id)"
        >
          <input type="checkbox" :checked="task.status === 'done'" @click.stop @change="store.toggleTask(task)" />
          <div class="task-main">
            <span class="title">{{ task.title }}</span>
            <span v-if="task.notes" class="notes">{{ task.notes }}</span>
            <div class="task-meta">
              <router-link v-if="task.event_id" class="event-link" :to="`/event/${task.event_id}`" @click.stop>
                {{ task.event?.title || 'View event' }}
              </router-link>
              <span v-if="task.due_date" class="due">Due {{ formatDate(task.due_date) }}</span>
              <span v-if="task.duration_minutes" class="meta-chip">{{ task.duration_minutes }} min</span>
              <span class="meta-chip priority-chip" :data-priority="task.priority || 'medium'">{{ task.priority || 'medium' }}</span>
              <span v-if="task.is_pinned" class="meta-chip">Pinned</span>
              <span v-if="task.recurrence_rule && !task.recurrence_paused" class="meta-chip">{{ task.recurrence_rule }}</span>
              <span v-else-if="task.recurrence_rule && task.recurrence_paused" class="meta-chip">{{ task.recurrence_rule }} (paused)</span>
            </div>
          </div>
          <span class="status">{{ formatTaskStatus(task.status) }}</span>
          <div class="task-actions">
            <button class="open" @click.stop="openTask(task.id)">Open</button>
            <button class="delete" @click.stop="handleDelete(task)">✕</button>
          </div>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '../stores/tasks'

const store = useTaskStore()
const router = useRouter()
const newTitle = ref('')
const newDueDate = ref('')

onMounted(async () => {
  await store.fetchTasks()
})

async function handleAdd() {
  await store.addTask(newTitle.value, newDueDate.value || null)
  newTitle.value = ''
  newDueDate.value = ''
}

function openTask(id) {
  router.push(`/task/${id}`)
}

async function handleDelete(task) {
  if (!confirm(`Delete "${task.title}"?`)) return
  await store.deleteTask(task.id)
}

function formatTaskStatus(status) {
  if (status === 'not_started') return 'Not started'
  if (status === 'in_progress') return 'In progress'
  if (status === 'done') return 'Done'
  return status
}

function formatDate(dateStr) {
  const parts = dateStr?.split('-').map(Number)
  if (!parts || parts.length !== 3 || parts.some(Number.isNaN)) return dateStr

  const [year, month, day] = parts
  return new Date(year, month - 1, day).toLocaleDateString()
}
</script>

<style scoped>
.tasks-view {
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

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
}

.add-form {
  display: grid;
  grid-template-columns: 2fr 1fr auto;
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

.task-list {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-row {
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--border);
  cursor: pointer;
}

.task-main {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.meta-chip {
  font-size: 0.78rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 9px;
  color: var(--muted);
}

.priority-chip[data-priority='high'] {
  border-color: #ef4444;
  color: #ef4444;
}

.priority-chip[data-priority='medium'] {
  border-color: #f59e0b;
  color: #b45309;
}

.priority-chip[data-priority='low'] {
  border-color: #10b981;
  color: #047857;
}

.event-link {
  font-size: 0.85rem;
  color: var(--accent);
  text-decoration: none;
}

.event-link:hover {
  text-decoration: underline;
}

.task-list li.completed .title {
  text-decoration: line-through;
  color: var(--muted);
}

.status {
  padding: 4px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  font-size: 12px;
  text-transform: capitalize;
}

.due {
  font-size: 0.85rem;
  color: var(--muted);
}

.notes {
  font-size: 0.85rem;
  color: var(--muted);
  white-space: pre-wrap;
}

.task-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.open {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 8px 12px;
  background: transparent;
  color: var(--text-strong);
  font-weight: 600;
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

  .task-list li {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .task-actions {
    margin-left: 0;
  }
}
</style>
