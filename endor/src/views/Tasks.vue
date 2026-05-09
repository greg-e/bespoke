<template>
  <section class="tasks-view">
    <header class="page-head">
      <div>
        <p class="eyebrow">Tasks</p>
        <h2>Personal task list</h2>
      </div>
      <p class="muted">Grouped by due date later; this starter keeps the data layer simple first.</p>
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
        <li v-for="task in store.tasks" :key="task.id" :class="{ completed: task.status === 'done' }">
          <input type="checkbox" :checked="task.status === 'done'" @change="store.toggleTask(task)" />
          <span class="title">{{ task.title }}</span>
          <span v-if="task.due_date" class="due">{{ formatDate(task.due_date) }}</span>
          <span class="status">{{ task.status }}</span>
          <button class="delete" @click="store.deleteTask(task.id)">✕</button>
        </li>
      </ul>
    </article>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useTaskStore } from '../stores/tasks'

const store = useTaskStore()
const newTitle = ref('')
const newDueDate = ref('')

onMounted(() => store.fetchTasks())

async function handleAdd() {
  await store.addTask(newTitle.value, newDueDate.value || null)
  newTitle.value = ''
  newDueDate.value = ''
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

.task-list li {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-bg);
  border: 1px solid var(--border);
}

.task-list li.completed .title {
  text-decoration: line-through;
  color: var(--muted);
}

.status {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(124, 58, 237, 0.08);
  color: var(--accent);
  font-size: 12px;
  text-transform: capitalize;
}

.due {
  font-size: 0.85rem;
  color: var(--muted);
  margin-left: auto;
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
