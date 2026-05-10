<template>
  <section class="settings-view">
    <header class="hero">
      <h1>Settings</h1>
    </header>

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

    <article class="panel microsoft-panel">
      <div class="panel-head">
        <h2>Microsoft Tasks</h2>
        <span class="pill">Personal + Work</span>
      </div>

      <p v-if="!microsoftConfigured" class="muted">
        Set <strong>VITE_MICROSOFT_CLIENT_ID</strong> in .env.local to connect Microsoft To Do.
      </p>

      <div v-else class="microsoft-grid">
        <section class="account-card">
          <div class="account-head">
            <div>
              <p class="eyebrow">Personal</p>
              <p class="muted">{{ microsoft.personal.email || 'Personal Microsoft account' }}</p>
            </div>
            <div class="account-actions">
              <button
                v-if="!microsoft.personal.connected"
                class="secondary"
                type="button"
                @click="connectMicrosoft('personal')"
              >
                Connect
              </button>
              <template v-else>
                <button class="secondary" type="button" @click="refreshMicrosoft('personal')">Refresh</button>
                <button class="ghost" type="button" @click="disconnectMicrosoft('personal')">Disconnect</button>
              </template>
            </div>
          </div>

          <p v-if="microsoft.personal.email" class="muted small">Connected as {{ microsoft.personal.email }}</p>
          <p v-if="microsoft.personal.error" class="error-text">{{ microsoft.personal.error }}</p>
          <p v-if="microsoft.personal.loading" class="muted">Loading tasks...</p>

          <ul v-else-if="microsoft.personal.tasks.length" class="list-card compact">
            <li v-for="task in microsoft.personal.tasks" :key="task.id">
              <div>
                <strong>{{ task.title || '(untitled)' }}</strong>
                <p class="muted small">{{ formatMicrosoftTaskMeta(task) }}</p>
              </div>
            </li>
          </ul>
          <p v-else class="muted">No tasks to show.</p>
        </section>

        <section class="account-card">
          <div class="account-head">
            <div>
              <p class="eyebrow">Work</p>
              <p class="muted">{{ microsoft.work.email || 'Work Microsoft account' }}</p>
            </div>
            <div class="account-actions">
              <button
                v-if="!microsoft.work.connected"
                class="secondary"
                type="button"
                @click="connectMicrosoft('work')"
              >
                Connect
              </button>
              <template v-else>
                <button class="secondary" type="button" @click="refreshMicrosoft('work')">Refresh</button>
                <button class="ghost" type="button" @click="disconnectMicrosoft('work')">Disconnect</button>
              </template>
            </div>
          </div>

          <p v-if="microsoft.work.email" class="muted small">Connected as {{ microsoft.work.email }}</p>
          <p v-if="microsoft.work.error" class="error-text">{{ microsoft.work.error }}</p>
          <p v-if="microsoft.work.loading" class="muted">Loading tasks...</p>

          <ul v-else-if="microsoft.work.tasks.length" class="list-card compact">
            <li v-for="task in microsoft.work.tasks" :key="task.id">
              <div>
                <strong>{{ task.title || '(untitled)' }}</strong>
                <p class="muted small">{{ formatMicrosoftTaskMeta(task) }}</p>
              </div>
            </li>
          </ul>
          <p v-else class="muted">No tasks to show.</p>
        </section>
      </div>
    </article>

    <article class="panel preferences-panel">
      <div class="panel-head">
        <h2>Notification Preferences</h2>
        <span class="pill">Morning + Evening</span>
      </div>

      <p v-if="!session.user" class="muted">Sign in to save your notification schedule.</p>
      <p v-else-if="preferencesLoading" class="muted">Loading preferences...</p>
      <form v-else class="preferences-form" @submit.prevent="persistPreferences">
        <div class="pref-row">
          <label class="toggle-inline">
            <input type="checkbox" v-model="preferences.morning_enabled" />
            <span>Morning notification</span>
          </label>
          <input type="time" v-model="preferences.morning_time" :disabled="!preferences.morning_enabled" />
          <input
            type="number"
            min="1"
            v-model="preferences.morning_snooze_minutes"
            :disabled="!preferences.morning_enabled"
            placeholder="Snooze min"
          />
        </div>

        <div class="pref-row">
          <label class="toggle-inline">
            <input type="checkbox" v-model="preferences.evening_enabled" />
            <span>Evening notification</span>
          </label>
          <input type="time" v-model="preferences.evening_time" :disabled="!preferences.evening_enabled" />
          <input
            type="number"
            min="1"
            v-model="preferences.evening_snooze_minutes"
            :disabled="!preferences.evening_enabled"
            placeholder="Snooze min"
          />
        </div>

        <div class="pref-actions">
          <button class="primary" type="submit" :disabled="preferencesSaving">
            {{ preferencesSaving ? 'Saving...' : 'Save preferences' }}
          </button>
          <span class="muted small">Times use your local timezone.</span>
          <span v-if="preferencesSaved" class="success-text">Saved.</span>
        </div>
      </form>

      <p v-if="preferencesError" class="error-text">{{ preferencesError }}</p>
    </article>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import { useSessionStore } from '../stores/session'
import {
  connectMicrosoftAccount,
  disconnectMicrosoftAccount,
  getMicrosoftAccountSummary,
  isMicrosoftConfigured,
  listMicrosoftTasks,
} from '../lib/microsoftTasks'
import { getNotificationPreferences, saveNotificationPreferences } from '../lib/preferences'

const PREFERENCES_STORAGE_KEY = 'endor_notification_preferences_v1'
const defaultPreferences = {
  morning_enabled: true,
  morning_time: '08:00',
  morning_snooze_minutes: 15,
  evening_enabled: true,
  evening_time: '16:00',
  evening_snooze_minutes: 15,
}

const session = useSessionStore()
const email = ref('')
const microsoftConfigured = isMicrosoftConfigured()
const preferences = ref({ ...defaultPreferences })
const preferencesLoading = ref(Boolean(session.user?.id))
const preferencesSaving = ref(false)
const preferencesError = ref(null)
const preferencesSaved = ref(false)

const microsoft = ref({
  personal: {
    connected: false,
    email: null,
    loading: false,
    error: null,
    tasks: [],
    listName: null,
  },
  work: {
    connected: false,
    email: null,
    loading: false,
    error: null,
    tasks: [],
    listName: null,
  },
})

function normalizePreferenceRecord(record) {
  if (!record) return { ...defaultPreferences }

  const normalizedMorningSnooze = Number.parseInt(record.morning_snooze_minutes, 10)
  const normalizedEveningSnooze = Number.parseInt(record.evening_snooze_minutes, 10)

  return {
    morning_enabled: record.morning_enabled ?? defaultPreferences.morning_enabled,
    morning_time: record.morning_time ?? defaultPreferences.morning_time,
    morning_snooze_minutes: Number.isNaN(normalizedMorningSnooze)
      ? defaultPreferences.morning_snooze_minutes
      : normalizedMorningSnooze,
    evening_enabled: record.evening_enabled ?? defaultPreferences.evening_enabled,
    evening_time: record.evening_time ?? defaultPreferences.evening_time,
    evening_snooze_minutes: Number.isNaN(normalizedEveningSnooze)
      ? defaultPreferences.evening_snooze_minutes
      : normalizedEveningSnooze,
  }
}

function readCachedPreferences(userId) {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (parsed?.userId !== userId || !parsed?.data) return null

    return normalizePreferenceRecord(parsed.data)
  } catch {
    return null
  }
}

function writeCachedPreferences(userId, data) {
  try {
    localStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify({ userId, data }),
    )
  } catch {
    // Ignore localStorage write failures.
  }
}

async function loadPreferences() {
  if (!session.user?.id) return

  preferencesLoading.value = true
  preferencesError.value = null

  const cached = readCachedPreferences(session.user.id)
  if (cached) {
    preferences.value = cached
  }

  try {
    const stored = await getNotificationPreferences(session.user.id)
    const normalized = normalizePreferenceRecord(stored)

    preferences.value = normalized
    writeCachedPreferences(session.user.id, normalized)
  } catch (error) {
    preferencesError.value = error?.message ?? String(error)
  } finally {
    preferencesLoading.value = false
  }
}

async function persistPreferences() {
  if (!session.user?.id) return

  preferencesSaving.value = true
  preferencesError.value = null
  preferencesSaved.value = false

  try {
    const patch = {
      morning_enabled: preferences.value.morning_enabled,
      morning_time: preferences.value.morning_time,
      morning_snooze_minutes:
        Number.parseInt(preferences.value.morning_snooze_minutes, 10) || defaultPreferences.morning_snooze_minutes,
      evening_enabled: preferences.value.evening_enabled,
      evening_time: preferences.value.evening_time,
      evening_snooze_minutes:
        Number.parseInt(preferences.value.evening_snooze_minutes, 10) || defaultPreferences.evening_snooze_minutes,
    }

    await saveNotificationPreferences(session.user.id, patch)
    const reloaded = await getNotificationPreferences(session.user.id)
    const normalized = normalizePreferenceRecord(reloaded || patch)

    preferences.value = normalized
    writeCachedPreferences(session.user.id, normalized)
    preferencesSaved.value = true
  } catch (error) {
    preferencesError.value = error?.message ?? String(error)
  } finally {
    preferencesSaving.value = false
  }
}

async function refreshMicrosoft(kind) {
  microsoft.value[kind].loading = true
  microsoft.value[kind].error = null

  try {
    const result = await listMicrosoftTasks(kind)
    microsoft.value[kind].tasks = result.tasks
    microsoft.value[kind].listName = result.listName
  } catch (error) {
    microsoft.value[kind].error = error?.message ?? String(error)
  } finally {
    microsoft.value[kind].loading = false
  }
}

async function connectMicrosoft(kind) {
  microsoft.value[kind].error = null

  try {
    const result = await connectMicrosoftAccount(kind)
    microsoft.value[kind].connected = true
    microsoft.value[kind].email = result.email
    await refreshMicrosoft(kind)
  } catch (error) {
    microsoft.value[kind].error = error?.message ?? String(error)
  }
}

async function disconnectMicrosoft(kind) {
  await disconnectMicrosoftAccount(kind)
  microsoft.value[kind] = {
    connected: false,
    email: null,
    loading: false,
    error: null,
    tasks: [],
    listName: null,
  }
}

async function hydrateMicrosoft() {
  if (!microsoftConfigured) return

  for (const kind of ['personal', 'work']) {
    const summary = await getMicrosoftAccountSummary(kind)
    microsoft.value[kind].connected = summary.connected
    microsoft.value[kind].email = summary.email

    if (summary.connected) {
      await refreshMicrosoft(kind)
    }
  }
}

async function handleSignIn() {
  await session.emailSignIn(email.value)
  email.value = ''
}

async function handleSignOut() {
  await session.logout()
}

function formatMicrosoftTaskMeta(task) {
  const status = task.status || 'notStarted'
  const dueDate = task.dueDateTime?.dateTime
  const importance = task.importance || 'normal'
  const dueLabel = dueDate ? `Due ${new Date(dueDate).toLocaleDateString()}` : 'No due date'

  return `${status} · ${importance} · ${dueLabel}`
}

onMounted(async () => {
  await Promise.all([hydrateMicrosoft(), loadPreferences()])
})

watch(
  () => session.user?.id,
  async (nextUserId, previousUserId) => {
    if (nextUserId && nextUserId !== previousUserId) {
      await loadPreferences()
        preferencesSaved.value = false
      return
    }

    if (!nextUserId) {
      preferences.value = { ...defaultPreferences }
      preferencesError.value = null
        preferencesSaved.value = false
    }
  },
)
</script>

<style scoped>
.settings-view {
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

.success-text {
  color: #166534;
  font-size: 0.9rem;
  font-weight: 600;
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

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
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

.list-card.compact li {
  padding: 10px;
}

@media (max-width: 860px) {
  .auth-panel,
  .hero {
    flex-direction: column;
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
