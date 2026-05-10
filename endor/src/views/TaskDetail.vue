<template>
  <section class="task-detail">
    <nav class="breadcrumb">
      <router-link to="/tasks">← Tasks</router-link>
    </nav>

    <div v-if="loading" class="muted">Loading task...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="task">
      <header class="page-head">
        <h1>{{ task.title }}</h1>
        <div class="head-actions">
          <button class="secondary" @click="setDone" :disabled="form.status === 'done'">Mark done</button>
          <button class="danger" @click="handleDelete">Delete task</button>
        </div>
      </header>

      <article class="panel">
        <form class="form-grid" @submit.prevent="saveTask">
          <label>
            <span>Title</span>
            <input v-model="form.title" required />
          </label>

          <label>
            <span>Status</span>
            <select v-model="form.status">
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>

          <label>
            <span>Priority</span>
            <select v-model="form.priority">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label>
            <span>Due date</span>
            <input v-model="form.due_date" type="date" />
          </label>

          <label>
            <span>Duration (minutes)</span>
            <input v-model="form.duration_minutes" type="number" min="1" />
          </label>

          <label>
            <span>Linked event</span>
            <select v-model="form.event_id">
              <option value="">No linked event</option>
              <option v-for="event in events" :key="event.id" :value="event.id">{{ event.title }}</option>
            </select>
          </label>

          <label class="toggle">
            <input v-model="form.is_pinned" type="checkbox" />
            <span>Pinned for Top 3</span>
          </label>

          <label>
            <span>Recurrence</span>
            <select v-model="form.recurrence_rule">
              <option value="">No recurrence</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>

          <label class="toggle">
            <input v-model="form.recurrence_paused" type="checkbox" :disabled="!form.recurrence_rule" />
            <span>Pause recurrence</span>
          </label>

          <label class="notes-field">
            <span>Notes</span>
            <textarea v-model="form.notes" rows="4" placeholder="Notes (optional)" />
          </label>

          <div class="form-actions">
            <button class="primary" type="submit">Save task</button>
            <span v-if="saveSuccess" class="success">Saved.</span>
          </div>
        </form>
      </article>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteTask, getTaskById, updateTask } from '../lib/tasks'
import { listEvents } from '../lib/events'

const route = useRoute()
const router = useRouter()

const task = ref(null)
const events = ref([])
const loading = ref(true)
const error = ref(null)
const saveSuccess = ref(false)

const form = ref({
  title: '',
  status: 'not_started',
  priority: 'medium',
  due_date: '',
  duration_minutes: '',
  event_id: '',
  notes: '',
  is_pinned: false,
  recurrence_rule: '',
  recurrence_paused: false,
})

onMounted(async () => {
  try {
    const [loadedTask, loadedEvents] = await Promise.all([
      getTaskById(route.params.id),
      listEvents(),
    ])

    task.value = loadedTask
    events.value = loadedEvents
    hydrateForm()
  } catch (err) {
    error.value = err?.message ?? String(err)
  } finally {
    loading.value = false
  }
})

function hydrateForm() {
  if (!task.value) return

  form.value = {
    title: task.value.title,
    status: task.value.status || 'not_started',
    priority: task.value.priority || 'medium',
    due_date: task.value.due_date || '',
    duration_minutes: task.value.duration_minutes ? String(task.value.duration_minutes) : '',
    event_id: task.value.event_id || '',
    notes: task.value.notes || '',
    is_pinned: Boolean(task.value.is_pinned),
    recurrence_rule: task.value.recurrence_rule || '',
    recurrence_paused: Boolean(task.value.recurrence_paused),
  }
}

async function saveTask() {
  if (!task.value || !form.value.title.trim()) return
  saveSuccess.value = false

  try {
    const normalizedDuration = Number.parseInt(form.value.duration_minutes, 10)
    const resolvedEventId = form.value.event_id || null

    task.value = await updateTask(task.value.id, {
      title: form.value.title.trim(),
      status: form.value.status,
      priority: form.value.priority,
      due_date: form.value.due_date || null,
      duration_minutes: Number.isNaN(normalizedDuration) ? null : normalizedDuration,
      event_id: resolvedEventId,
      is_linked_to_event: Boolean(resolvedEventId),
      notes: form.value.notes.trim() || null,
      is_pinned: form.value.is_pinned,
      recurrence_rule: form.value.recurrence_rule || null,
      recurrence_paused: form.value.recurrence_rule ? form.value.recurrence_paused : false,
    })

    hydrateForm()
    error.value = null
    saveSuccess.value = true
  } catch (err) {
    error.value = err?.message ?? String(err)
  }
}

async function setDone() {
  form.value.status = 'done'
  await saveTask()
}

async function handleDelete() {
  if (!task.value) return
  if (!confirm(`Delete "${task.value.title}"?`)) return

  try {
    await deleteTask(task.value.id)
    router.push('/tasks')
  } catch (err) {
    error.value = err?.message ?? String(err)
  }
}
</script>

<style scoped>
.task-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.breadcrumb a {
  color: var(--accent);
  text-decoration: none;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.head-actions {
  display: flex;
  gap: 8px;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label span {
  font-size: 0.82rem;
  color: var(--muted);
}

input,
select,
textarea {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
}

.toggle {
  align-self: end;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.notes-field,
.form-actions {
  grid-column: 1 / -1;
}

.primary,
.secondary,
.danger {
  border: 0;
  border-radius: 12px;
  padding: 10px 14px;
  font-weight: 700;
}

.primary {
  background: var(--accent);
  color: white;
}

.secondary {
  border: 1px solid var(--border);
  background: var(--panel-bg);
  color: var(--text-strong);
}

.danger {
  background: #ef4444;
  color: white;
}

.error {
  color: #ef4444;
}

.success {
  color: #166534;
  font-weight: 600;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
