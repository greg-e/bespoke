<template>
  <section class="event-detail">
    <nav class="breadcrumb">
      <router-link to="/calendar">← Calendar</router-link>
    </nav>

    <div v-if="loading" class="muted">Loading event…</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="event">
      <header class="page-head">
        <h1 v-if="!editing" @click="startEdit" class="editable-title" title="Click to edit">{{ event.title }}</h1>
        <input v-else v-model="editTitle" class="title-input" @blur="saveTitle" @keydown.enter="saveTitle" @keydown.escape="cancelEdit" autofocus />
        <div class="head-actions">
          <button class="secondary" @click="startEditEvent">Edit event</button>
          <button class="danger" @click="handleDelete">Delete event</button>
        </div>
      </header>

      <article v-if="editingEvent" class="panel edit-panel">
        <form class="edit-form" @submit.prevent="saveEventDetails">
          <label>
            <span>Title</span>
            <input v-model="eventForm.title" required />
          </label>

          <label>
            <span>Starts</span>
            <input v-model="eventForm.starts_at" type="datetime-local" />
          </label>

          <label>
            <span>Ends</span>
            <input v-model="eventForm.ends_at" type="datetime-local" />
          </label>

          <label class="edit-toggle">
            <input v-model="eventForm.is_shared" type="checkbox" />
            <span>Shared event</span>
          </label>

          <label class="edit-notes-field">
            <span>Notes</span>
            <textarea v-model="eventForm.notes" rows="3" placeholder="Notes (optional)" />
          </label>

          <div class="edit-actions">
            <button type="submit" class="primary">Save changes</button>
            <button type="button" class="secondary" @click="cancelEditEvent">Cancel</button>
            <span v-if="eventSaveSuccess" class="success">Saved.</span>
          </div>
        </form>
      </article>

      <div class="meta-grid">
        <article class="panel">
          <p class="eyebrow">Starts</p>
          <p>{{ formatDateTime(event.starts_at) || '—' }}</p>
        </article>
        <article class="panel">
          <p class="eyebrow">Ends</p>
          <p>{{ formatDateTime(event.ends_at) || '—' }}</p>
        </article>
      </div>

      <article class="panel notes-panel" v-if="event.notes || editingNotes">
        <p class="eyebrow">Notes</p>
        <p v-if="!editingNotes" @click="startEditNotes" class="editable-notes muted" title="Click to edit">{{ event.notes || 'Add notes…' }}</p>
        <textarea v-else v-model="editNotes" @blur="saveNotes" @keydown.escape="cancelEditNotes" rows="4" autofocus />
      </article>
      <button v-else class="secondary" @click="startEditNotes">+ Add notes</button>

      <article class="panel comments-panel">
        <div class="panel-head">
          <p class="eyebrow">Comments</p>
          <span class="pill">{{ comments.length }}</span>
        </div>

        <ul class="comments-list" v-if="comments.length">
          <li v-for="comment in comments" :key="comment.id">
            <p>{{ comment.body }}</p>
            <div class="comment-meta">
              <span class="muted small">{{ formatDateTime(comment.created_at) }}</span>
              <button class="item-delete" @click="removeComment(comment.id)">Delete</button>
            </div>
          </li>
        </ul>
        <p v-else class="muted">No comments yet.</p>

        <form class="inline-add" @submit.prevent="addComment">
          <input v-model="newCommentBody" placeholder="Add a comment..." />
          <button type="submit">Add</button>
        </form>

        <p v-if="commentsError" class="error">{{ commentsError }}</p>
      </article>

      <article class="panel attachments-panel">
        <div class="panel-head">
          <p class="eyebrow">Attachments</p>
          <span class="pill">{{ attachments.length }}</span>
        </div>

        <ul class="attachments-list" v-if="attachments.length">
          <li v-for="attachment in attachments" :key="attachment.id">
            <a :href="resolveAttachmentHref(attachment.file_url)" target="_blank" rel="noreferrer noopener">{{ attachment.file_name }}</a>
            <button class="item-delete" @click="removeAttachment(attachment.id)">Delete</button>
          </li>
        </ul>
        <p v-else class="muted">No attachments yet.</p>

        <form class="inline-add" @submit.prevent="addAttachment">
          <input v-model="newAttachmentName" placeholder="File label (optional)" />
          <input ref="attachmentFileInput" type="file" @change="handleAttachmentSelected" />
          <button type="submit" :disabled="attachmentUploading || !newAttachmentFile">
            {{ attachmentUploading ? 'Uploading...' : 'Upload' }}
          </button>
        </form>

        <p v-if="attachmentsError" class="error">{{ attachmentsError }}</p>
      </article>

      <article class="panel checklist-panel">
        <div class="panel-head">
          <p class="eyebrow">Checklist</p>
          <span class="pill">{{ checklist.filter(i => i.completed).length }}/{{ checklist.length }}</span>
        </div>

        <ul class="checklist">
          <li v-for="item in checklist" :key="item.id" :class="{ done: item.completed }">
            <input
              type="checkbox"
              :checked="item.completed"
              @change="toggleItem(item)"
            />
            <span class="item-title">{{ item.title }}</span>
            <button
              v-if="!item.converted_task_id"
              class="promote"
              title="Convert to task"
              @click="promoteItem(item)"
            >→ Task</button>
            <span v-else class="converted-badge">✓ Task</span>
            <button class="item-delete" @click="removeItem(item.id)">✕</button>
          </li>
        </ul>

        <form class="checklist-add" @submit.prevent="addItem">
          <input v-model="newItemTitle" placeholder="Add checklist item…" />
          <button type="submit">Add</button>
        </form>

        <p v-if="checklistError" class="error">{{ checklistError }}</p>
      </article>
    </template>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getEventById, updateEvent, deleteEvent } from '../lib/events'
import {
  listChecklistItemsForEvent,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  convertChecklistItemToTask,
} from '../lib/checklists'
import { createComment, deleteComment, listComments } from '../lib/comments'
import {
  buildAttachmentPath,
  createAttachmentRecord,
  deleteAttachmentAndFile,
  listAttachments,
  resolveAttachmentUrl,
  uploadAttachmentFile,
} from '../lib/attachments'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

const event = ref(null)
const loading = ref(true)
const error = ref(null)

const checklist = ref([])
const newItemTitle = ref('')
const checklistError = ref(null)
const commentsError = ref(null)
const attachmentsError = ref(null)
const comments = ref([])
const newCommentBody = ref('')
const attachments = ref([])
const newAttachmentName = ref('')
const newAttachmentFile = ref(null)
const attachmentFileInput = ref(null)
const attachmentUploading = ref(false)

const editing = ref(false)
const editTitle = ref('')
const editingNotes = ref(false)
const editNotes = ref('')
const editingEvent = ref(false)
const eventSaveSuccess = ref(false)
const eventForm = ref({
  title: '',
  starts_at: '',
  ends_at: '',
  notes: '',
  is_shared: false,
})

onMounted(async () => {
  try {
    event.value = await getEventById(route.params.id)
    const [eventChecklist, eventComments, eventAttachments] = await Promise.all([
      listChecklistItemsForEvent(route.params.id),
      listComments('event', route.params.id),
      listAttachments('event', route.params.id),
    ])
    checklist.value = eventChecklist
    comments.value = eventComments
    attachments.value = eventAttachments
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

async function addComment() {
  if (!newCommentBody.value.trim() || !session.user?.id) return
  commentsError.value = null

  try {
    const createdComment = await createComment({
      parent_type: 'event',
      parent_id: route.params.id,
      body: newCommentBody.value,
      created_by: session.user.id,
    })
    comments.value.push(createdComment)
    newCommentBody.value = ''
  } catch (e) {
    commentsError.value = e.message
  }
}

async function removeComment(commentId) {
  commentsError.value = null
  try {
    await deleteComment(commentId)
    comments.value = comments.value.filter((comment) => comment.id !== commentId)
  } catch (e) {
    commentsError.value = e.message
  }
}

async function addAttachment() {
  if (!newAttachmentFile.value || !session.user?.id) return
  attachmentsError.value = null

  attachmentUploading.value = true

  try {
    const storagePath = buildAttachmentPath({
      parentType: 'event',
      parentId: route.params.id,
      userId: session.user.id,
      fileName: newAttachmentFile.value.name,
    })

    await uploadAttachmentFile({
      path: storagePath,
      file: newAttachmentFile.value,
    })

    const createdAttachment = await createAttachmentRecord({
      parent_type: 'event',
      parent_id: route.params.id,
      file_name: newAttachmentName.value.trim() || newAttachmentFile.value.name,
      file_url: storagePath,
      mime_type: newAttachmentFile.value.type || null,
      file_size_bytes: newAttachmentFile.value.size,
      created_by: session.user.id,
    })

    attachments.value.push(createdAttachment)
    newAttachmentName.value = ''

    if (attachmentFileInput.value) {
      attachmentFileInput.value.value = ''
    }

    newAttachmentFile.value = null
  } catch (e) {
    attachmentsError.value = e.message
  } finally {
    attachmentUploading.value = false
  }
}

async function removeAttachment(attachmentId) {
  attachmentsError.value = null
  try {
    const attachment = attachments.value.find((item) => item.id === attachmentId)
    if (!attachment) return

    await deleteAttachmentAndFile(attachment)
    attachments.value = attachments.value.filter((attachment) => attachment.id !== attachmentId)
  } catch (e) {
    attachmentsError.value = e.message
  }
}

function handleAttachmentSelected(event) {
  const [selectedFile] = event.target.files || []
  newAttachmentFile.value = selectedFile || null
}

function resolveAttachmentHref(fileUrl) {
  return resolveAttachmentUrl(fileUrl)
}

async function addItem() {
  if (!newItemTitle.value.trim()) return
  checklistError.value = null
  try {
    const item = await createChecklistItem(route.params.id, newItemTitle.value)
    checklist.value.push(item)
    newItemTitle.value = ''
  } catch (e) {
    checklistError.value = e.message
  }
}

async function toggleItem(item) {
  checklistError.value = null
  try {
    const updated = await updateChecklistItem(item.id, { completed: !item.completed })
    const idx = checklist.value.findIndex(i => i.id === item.id)
    if (idx !== -1) checklist.value[idx] = updated
  } catch (e) {
    checklistError.value = e.message
  }
}

async function removeItem(id) {
  checklistError.value = null
  try {
    await deleteChecklistItem(id)
    checklist.value = checklist.value.filter(i => i.id !== id)
  } catch (e) {
    checklistError.value = e.message
  }
}

async function promoteItem(item) {
  checklistError.value = null
  try {
    const { checklistItem: updated } = await convertChecklistItemToTask(item, {
      created_by: session.user?.id,
    })
    const idx = checklist.value.findIndex(i => i.id === item.id)
    if (idx !== -1) checklist.value[idx] = updated
  } catch (e) {
    checklistError.value = e.message
  }
}

function startEdit() {
  editTitle.value = event.value.title
  editing.value = true
}

function startEditEvent() {
  if (!event.value) return

  editingEvent.value = true
  eventSaveSuccess.value = false
  eventForm.value = {
    title: event.value.title || '',
    starts_at: toLocalDateTimeInput(event.value.starts_at),
    ends_at: toLocalDateTimeInput(event.value.ends_at),
    notes: event.value.notes || '',
    is_shared: Boolean(event.value.is_shared),
  }
}

function cancelEditEvent() {
  editingEvent.value = false
  eventSaveSuccess.value = false
}

function cancelEdit() {
  editing.value = false
}

async function saveTitle() {
  if (!editTitle.value.trim() || editTitle.value.trim() === event.value.title) {
    editing.value = false
    return
  }
  try {
    event.value = await updateEvent(event.value.id, { title: editTitle.value.trim() })
  } catch (e) {
    error.value = e.message
  } finally {
    editing.value = false
  }
}

function startEditNotes() {
  editNotes.value = event.value.notes || ''
  editingNotes.value = true
}

function cancelEditNotes() {
  editingNotes.value = false
}

async function saveNotes() {
  try {
    event.value = await updateEvent(event.value.id, { notes: editNotes.value.trim() || null })
  } catch (e) {
    error.value = e.message
  } finally {
    editingNotes.value = false
  }
}

async function saveEventDetails() {
  if (!event.value || !eventForm.value.title.trim()) return

  eventSaveSuccess.value = false

  try {
    event.value = await updateEvent(event.value.id, {
      title: eventForm.value.title.trim(),
      starts_at: eventForm.value.starts_at || null,
      ends_at: eventForm.value.ends_at || null,
      notes: eventForm.value.notes.trim() || null,
      is_shared: eventForm.value.is_shared,
    })

    error.value = null
    eventSaveSuccess.value = true
    editingEvent.value = false
  } catch (e) {
    error.value = e.message
  }
}

async function handleDelete() {
  if (!confirm(`Delete "${event.value.title}"?`)) return
  try {
    await deleteEvent(event.value.id)
    router.push('/calendar')
  } catch (e) {
    error.value = e.message
  }
}

function formatDateTime(dt) {
  if (!dt) return null
  const parsed = new Date(dt)
  if (Number.isNaN(parsed.getTime())) return dt
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function toLocalDateTimeInput(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}
</script>

<style scoped>
.event-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.breadcrumb a {
  color: var(--accent);
  text-decoration: none;
  font-size: 0.9rem;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.head-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: var(--accent);
  margin-bottom: 6px;
}

.muted { color: var(--muted); }

.editable-title {
  cursor: text;
  margin: 0;
}

.editable-title:hover {
  text-decoration: underline dotted;
}

.title-input {
  font-size: 1.5rem;
  font-weight: 700;
  border: none;
  border-bottom: 2px solid var(--accent);
  background: transparent;
  color: var(--text-strong);
  width: 100%;
  outline: none;
  padding: 4px 0;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 18px;
  box-shadow: var(--shadow-soft);
}

.edit-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.edit-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edit-form label span {
  font-size: 0.82rem;
  color: var(--muted);
}

.edit-form input,
.edit-form textarea {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
}

.edit-notes-field,
.edit-actions {
  grid-column: 1 / -1;
}

.edit-toggle {
  align-self: end;
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.edit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notes-panel p.editable-notes {
  cursor: text;
  white-space: pre-wrap;
  min-height: 2rem;
}

.notes-panel p.editable-notes:hover {
  text-decoration: underline dotted;
}

.notes-panel textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px;
  background: var(--panel-bg);
  color: var(--text-strong);
  resize: vertical;
  font-family: inherit;
  font-size: 1rem;
  outline: none;
  box-sizing: border-box;
}

.danger {
  border: 0;
  border-radius: 12px;
  padding: 10px 18px;
  background: #ef4444;
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.secondary {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 18px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  align-self: flex-start;
}

.error { color: #ef4444; }

.success {
  color: #166534;
  font-weight: 600;
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.comments-list,
.attachments-list {
  list-style: none;
  padding: 0;
  margin: 0 0 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.comments-list li,
.attachments-list li {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--panel-bg);
  border: 1px solid var(--border);
}

.comments-list p {
  margin: 0;
  white-space: pre-wrap;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.inline-add {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.attachments-panel .inline-add {
  grid-template-columns: 1fr 2fr auto;
}

.inline-add input {
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
  min-width: 0;
}

.inline-add button {
  border: 0;
  border-radius: 12px;
  padding: 10px 16px;
  background: var(--accent);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

.pill {
  font-size: 0.75rem;
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
  border-radius: 20px;
  padding: 2px 10px;
  font-weight: 600;
}

.checklist {
  list-style: none;
  padding: 0;
  margin: 0 0 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checklist li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--panel-bg);
  border: 1px solid var(--border);
}

.checklist li.done .item-title {
  text-decoration: line-through;
  color: var(--muted);
}

.item-title {
  flex: 1;
  min-width: 0;
}

.promote {
  border: 1px solid var(--accent);
  border-radius: 8px;
  padding: 3px 10px;
  background: transparent;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.promote:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

.converted-badge {
  font-size: 0.8rem;
  color: var(--muted);
  flex-shrink: 0;
}

.item-delete {
  border: 0;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
}

.item-delete:hover {
  color: #ef4444;
}

.checklist-add {
  display: flex;
  gap: 8px;
}

.checklist-add input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
  min-width: 0;
}

.checklist-add button {
  border: 0;
  border-radius: 12px;
  padding: 10px 16px;
  background: var(--accent);
  color: white;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 600px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }

  .edit-form {
    grid-template-columns: 1fr;
  }

  .inline-add,
  .attachments-panel .inline-add {
    grid-template-columns: 1fr;
  }
}
</style>
