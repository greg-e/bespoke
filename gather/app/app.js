const DATA_FILES = {
  site: '../data/site.json',
  schedule: '../data/schedule.json',
  assignments: '../data/assignments.json',
  food: '../data/food.json',
}

const STORAGE_PREFIX = 'gather-june-2026:'
const DRAFT_STORAGE_KEY = STORAGE_PREFIX + 'drafts'

const drafts = loadDrafts()

const state = {
  data: {},
  expandedDays: new Set(),
  usedCacheFallback: false,
  currentView: 'schedule',
  searchQuery: '',
  hasDraftEdits: Object.keys(drafts).length > 0,
}

const el = {
  title: document.getElementById('app-title'),
  subtitle: document.getElementById('app-subtitle'),
  mapLink: document.getElementById('map-link'),
  statusStrip: document.getElementById('status-strip'),
  skeleton: document.getElementById('skeleton'),
  content: document.getElementById('content'),
  accordionRoot: document.getElementById('accordion-root'),
  navTabs: document.querySelectorAll('.nav-tab'),
  assignmentSearch: document.getElementById('assignment-search'),
  assignmentsList: document.getElementById('assignments-list'),
  foodContent: document.getElementById('food-content'),
}

bootstrap()

window.addEventListener('online', () => render())
window.addEventListener('offline', () => render())

async function bootstrap() {
  const entries = await Promise.all(
    Object.entries(DATA_FILES).map(async ([key, path]) => {
      const result = await loadJsonWithCache(key, path)
      return [key, result]
    }),
  )

  for (const [key, value] of entries) {
    state.data[key] = value
    if (value.source === 'cache') {
      state.usedCacheFallback = true
    }
  }

  state.hasDraftEdits = Object.keys(drafts).length > 0
  el.skeleton.classList.add('hidden')
  bindNavHandlers()
  bindSearchHandler()
  bindAccordionHandlers()
  showMainView()
}

function bindNavHandlers() {
  el.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view
      switchView(view)
    })
  })
}

function bindSearchHandler() {
  el.assignmentSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase()
    renderAssignments()
  })
}

function switchView(viewName) {
  state.currentView = viewName

  // Update nav tabs
  el.navTabs.forEach((tab) => {
    if (tab.dataset.view === viewName) {
      tab.classList.add('is-active')
    } else {
      tab.classList.remove('is-active')
    }
  })

  // Update content views
  const views = document.querySelectorAll('.view')
  views.forEach((view) => {
    view.classList.add('hidden')
  })
  const activeView = document.getElementById('view-' + viewName)
  if (activeView) {
    activeView.classList.remove('hidden')
  }

  render()
}

async function loadJsonWithCache(key, path) {
  const storageKey = STORAGE_PREFIX + key

  try {
    const response = await fetch(path, { cache: 'no-store' })

    if (!response.ok) {
      throw new Error('Non-success response for ' + key)
    }

    const content = await response.json()
    localStorage.setItem(storageKey, JSON.stringify(content))

    return { content, source: 'network' }
  } catch (_error) {
    const cachedRaw = localStorage.getItem(storageKey)

    if (!cachedRaw) {
      throw new Error('Could not load required file: ' + key)
    }

    return { content: JSON.parse(cachedRaw), source: 'cache' }
  }
}

function showMainView() {
  el.statusStrip.classList.remove('hidden')
  el.content.classList.remove('hidden')
  render()
}

function render() {
  renderStatusStrip()

  if (state.currentView === 'schedule') {
    renderAccordion()
  } else if (state.currentView === 'assignments') {
    renderAssignments()
  } else if (state.currentView === 'food') {
    renderFood()
  }
}

function renderStatusStrip() {
  const parts = []

  if (!navigator.onLine) {
    parts.push('<span class="badge offline">Offline mode: showing last-loaded data</span>')
  } else if (state.usedCacheFallback) {
    parts.push('<span class="badge">Some content loaded from local cache</span>')
  } else {
    parts.push('<span class="badge ok">Live data loaded</span>')
  }

  if (state.hasDraftEdits) {
    parts.push('<span class="badge draft">Draft edits saved in this browser</span>')
  }

  el.statusStrip.innerHTML = parts.join('')
}

function renderAccordion() {
  const site = state.data.site.content
  const schedule = state.data.schedule.content
  const assignments = state.data.assignments.content

  el.title.textContent = site.title

  // Calculate countdown
  const daysUntil = calculateDaysUntil(site.dateRange.start)
  if (daysUntil > 0) {
    el.subtitle.textContent = 'in ' + daysUntil + ' day' + (daysUntil === 1 ? '' : 's')
  } else {
    el.subtitle.textContent = 'Gather in progress!'
  }

  // Set map link
  if (site.location && site.location.mapOpenUrl) {
    el.mapLink.href = site.location.mapOpenUrl
    el.mapLink.textContent = 'Link to Map of ' + site.location.name
  }

  let html = ''

  for (const day of schedule.days) {
    const isExpanded = state.expandedDays.has(day.date)
    const dayAssignments = assignments.entries.filter((entry) => entry.day === day.date)

    html += '<div class="accordion-day ' + (isExpanded ? 'is-expanded' : '') + '" data-date="' + escapeHtml(day.date) + '">'
    html += '<button class="accordion-header" type="button">' + escapeHtml(day.label) + '</button>'
    html += '<div class="accordion-content">'
    html += '<div class="accordion-body">'

    // Merged schedule + assignments
    if (day.timeline && day.timeline.length > 0) {
      html += '<ul class="day-schedule">'
      for (const [index, item] of day.timeline.entries()) {
        const itemPath = 'schedule.days.' + day.date + '.timeline.' + index
        const title = getEditableValue(itemPath + '.title', item.title || '')
        const time = getEditableValue(itemPath + '.time', item.time || '')
        const note = getEditableValue(itemPath + '.note', item.note || '')
        const hasTime = time.trim().length > 0
        const liClass = hasTime ? '' : ' class="flexible"'
        
        html += '<li' + liClass + '>'
        html += '<div class="activity-header">'
        html += '<strong>' + escapeHtml(title || 'Untitled item') + '</strong>'
        if (hasTime) {
          html += ' <span class="activity-time">' + escapeHtml(time) + '</span>'
        } else {
          html += ' <span class="activity-note">' + renderEditableText(itemPath + '.note', note, 'Add note', 'inline-note') + '</span>'
        }
        html += '</div>'

        if (title && (title.toLowerCase().includes('hangout') || title.toLowerCase().includes('free time'))) {
          html += renderHangoutPrompt()
        }
        
        // Find related assignments (for timed activities and specific named activities like Lunch)
        const isSpecialActivity = title && (title.toLowerCase().includes('lunch') || title.toLowerCase().includes('hangout'))
        const relatedAssignments = (hasTime || isSpecialActivity) ? findAssignmentsForActivity(title, dayAssignments) : []
        
        if (relatedAssignments.length > 0) {
          for (const assignment of relatedAssignments) {
            html += '<div class="assignment-inline">'
            html += renderAssignmentDetails(assignment, title)
            html += '</div>'
          }
        }
        
        html += '</li>'
      }
      html += '</ul>'
    } else {
      html += '<p class="muted">No schedule for this day.</p>'
    }

    html += '</div>' // accordion-body
    html += '</div>' // accordion-content
    html += '</div>' // accordion-day
  }

  el.accordionRoot.innerHTML = html
  bindAccordionHandlers()
  bindEditableFields()
}

function findAssignmentsForActivity(activityTitle, dayAssignments) {
  const title = (activityTitle || '').toLowerCase()
  const matches = []

  for (const assignment of dayAssignments) {
    const type = (assignment.type || '').toLowerCase()
    
    // Match logic
    if (title.includes('brunch') && type.includes('breakfast')) {
      matches.push(assignment)
    } else if (title.includes('group activity') && type.includes('activity')) {
      matches.push(assignment)
    } else if (title.includes('supper') && type.includes('meal')) {
      matches.push(assignment)
    } else if (title.includes('supper') && type.includes('cleanup')) {
      matches.push(assignment)
    } else if (title.includes('lunch') && type.includes('salad')) {
      matches.push(assignment)
    } else if (title.includes('devo') && type.includes('devo')) {
      matches.push(assignment)
    } else if ((title.includes('hangout') || title.includes('free')) && type.includes('hangout')) {
      matches.push(assignment)
    } else if (title.includes('cleanup') && type.includes('cleanup')) {
      matches.push(assignment)
    }
  }
  
  return matches
}

function bindAccordionHandlers() {
  const headers = document.querySelectorAll('.accordion-header')
  for (const header of headers) {
    header.addEventListener('click', () => {
      const day = header.closest('.accordion-day')
      const date = day.dataset.date
      if (state.expandedDays.has(date)) {
        state.expandedDays.delete(date)
      } else {
        state.expandedDays.add(date)
      }
      render()
    })
  }
}

function calculateDaysUntil(isoDateString) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const target = parseIsoLocal(isoDateString)
  target.setHours(0, 0, 0, 0)

  const diff = target.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  return Math.max(days, 0)
}

function parseIsoLocal(isoDateString) {
  const [year, month, day] = isoDateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(isoString) {
  const date = parseIsoLocal(isoString)
  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
  return formatter.format(date)
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function maybeTbd(text) {
  if ((text || '').toUpperCase().includes('TBD')) {
    return '<span class="tbd">TBD</span>'
  }
  return ''
}

function renderAssignments() {
  const assignments = state.data.assignments.content
  const daysMap = {}
  const dayLabels = {}

  // Build label map
  for (const dayInfo of assignments.days) {
    dayLabels[dayInfo.date] = dayInfo.label
  }

  // Group assignments by day
  for (const assignment of assignments.entries) {
    const day = assignment.day
    if (!daysMap[day]) {
      daysMap[day] = []
    }
    daysMap[day].push(assignment)
  }

  // Filter based on search query
  let filtered = []
  for (const [date, assignmentsList] of Object.entries(daysMap)) {
    for (const assignment of assignmentsList) {
      const dayLabel = dayLabels[date] || date
      const text = `${dayLabel} ${assignment.type} ${assignment.assignee}`.toLowerCase()
      if (state.searchQuery === '' || text.includes(state.searchQuery)) {
        filtered.push({ date, dayLabel, ...assignment })
      }
    }
  }

  // Render
  el.assignmentsList.innerHTML = ''

  if (filtered.length === 0) {
    el.assignmentsList.innerHTML = '<p style="padding: 1rem; color: var(--muted);">No assignments found.</p>'
    return
  }

  // Sort by date order
  filtered.sort((a, b) => new Date(a.date) - new Date(b.date))

  for (const assignment of filtered) {
    const item = document.createElement('div')
    item.className = 'assignment-item'
    item.innerHTML = `
      <div class="assignment-day">${escapeHtml(assignment.dayLabel)}</div>
      <div class="assignment-type">${escapeHtml(assignment.type)}</div>
      <div class="assignment-person">${renderAssignmentDetails(assignment, assignment.dayLabel)}</div>
    `
    el.assignmentsList.appendChild(item)
  }

  bindEditableFields()
}

function renderFood() {
  const food = state.data.food.content

  let html = '<div class="food-view">'

  html += '<h2>Food & Meal Planning</h2>'

  if (food.shoppingDocUrl) {
    html += `<p><a href="${escapeHtml(food.shoppingDocUrl)}" target="_blank" style="color: var(--text); text-decoration: underline; font-weight: 500;">Open Shopping List (Google Doc)</a></p>`
  }

  if (food.allergies && food.allergies.length > 0) {
    html += '<h3 style="margin-top: 1.5rem;">Allergies & Dietary Notes</h3>'
    html += '<ul style="margin: 0.5rem 0 0 1.5rem;">'
    for (const allergy of food.allergies) {
      html += `<li>${escapeHtml(allergy)}</li>`
    }
    html += '</ul>'
  }

  html += '</div>'

  el.foodContent.innerHTML = html
}

function loadDrafts() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}

    return parsed
  } catch {
    return {}
  }
}

function saveDrafts() {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // Ignore localStorage failures.
  }

  state.hasDraftEdits = Object.keys(drafts).length > 0
}

function getDraftValue(path) {
  if (!Object.prototype.hasOwnProperty.call(drafts, path)) return null
  return drafts[path]
}

function getEditableValue(path, fallback) {
  const draftValue = getDraftValue(path)
  if (draftValue === null) return fallback
  return draftValue
}

function setDraftValue(path, value) {
  const normalized = String(value ?? '').trim()

  if (!normalized) {
    delete drafts[path]
  } else {
    drafts[path] = normalized
  }

  saveDrafts()
}

function renderEditableText(path, value, placeholder, extraClass = '') {
  const resolved = String(value ?? '').trim()
  const isPlaceholder = resolved.length === 0
  const text = isPlaceholder ? placeholder : resolved
  const className = ['inline-edit', extraClass, isPlaceholder ? 'is-placeholder' : '']
    .filter(Boolean)
    .join(' ')

  return '<span class="' + className + '" contenteditable="true" spellcheck="false" data-edit-path="' + escapeHtml(path) + '" data-placeholder="' + escapeHtml(placeholder) + '" data-original-text="' + escapeHtml(text) + '">' + escapeHtml(text) + '</span>'
}

function renderAssignmentDetails(assignment, contextTitle = '') {
  const type = String(assignment.type || '').toLowerCase()
  const title = String(contextTitle || '').toLowerCase()
  const assigneePath = 'assignments.entries.' + assignment.id + '.assignee'
  const assigneeValue = getEditableValue(assigneePath, assignment.assignee === 'TBD' ? '' : assignment.assignee)

  if (type.includes('cleanup')) {
    return '<div class="assignment-detail assignment-detail--single"><span class="assignment-label">Cleanup Crew</span>' + renderEditableText(assigneePath, assigneeValue, 'Add assignee', 'inline-assignee') + '</div>'
  }

  if (type.includes('activity')) {
    const activityTitlePath = 'assignments.entries.' + assignment.id + '.activity_title'
    const activityTitleValue = getEditableValue(activityTitlePath, '')

    return [
      '<div class="assignment-detail assignment-detail--stacked">',
      '<div class="assignment-detail-row">',
      '<span class="assignment-label">Activity title</span>',
      renderEditableText(activityTitlePath, activityTitleValue, 'Add activity title', 'inline-assignment-title'),
      '</div>',
      '<div class="assignment-detail-row">',
      '<span class="assignment-label">Lead</span>',
      renderEditableText(assigneePath, assigneeValue, 'Add assignee', 'inline-assignee'),
      '</div>',
      '</div>',
    ].join('')
  }

  if (title.includes('lunch')) {
    return renderEditableText(assigneePath, assigneeValue, 'Add assignee', 'inline-assignee') + ' - ' + escapeHtml(assignment.type)
  }

  return renderEditableText(assigneePath, assigneeValue, 'Add assignee', 'inline-assignee')
}

function renderHangoutPrompt() {
  const whatsappIcon = './assets/whatsapp-glyph-green.svg'

  return [
    '<div class="hangout-prompt">',
    '<img class="hangout-prompt__icon" src="' + whatsappIcon + '" alt="WhatsApp" width="24" height="24" />',
    '<p class="hangout-prompt__text"><strong>Share pictures!</strong> Tell us what you\'re doing!</p>',
    '</div>',
  ].join('')
}

function bindEditableFields() {
  const fields = document.querySelectorAll('.inline-edit')

  for (const field of fields) {
    if (field.dataset.bound === 'true') continue

    field.dataset.bound = 'true'
    field.addEventListener('focus', handleEditableFocus)
    field.addEventListener('blur', handleEditableBlur)
    field.addEventListener('keydown', handleEditableKeydown)
  }
}

function handleEditableFocus(event) {
  const field = event.currentTarget

  if (field.classList.contains('is-placeholder')) {
    field.textContent = ''
    field.classList.remove('is-placeholder')
  }

  field.dataset.originalText = field.textContent || ''
  field.dataset.editCanceled = 'false'
}

function handleEditableKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    event.currentTarget.blur()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    const field = event.currentTarget
    field.dataset.editCanceled = 'true'
    field.textContent = field.dataset.originalText || field.dataset.placeholder || ''
    field.blur()
  }
}

function handleEditableBlur(event) {
  const field = event.currentTarget

  if (field.dataset.editCanceled === 'true') {
    field.dataset.editCanceled = 'false'
    return
  }

  const path = field.dataset.editPath
  const placeholder = field.dataset.placeholder || 'Add value'
  const nextValue = (field.textContent || '').trim()

  if (!nextValue) {
    field.classList.add('is-placeholder')
    field.textContent = placeholder
  } else {
    field.classList.remove('is-placeholder')
    field.textContent = nextValue
  }

  setDraftValue(path, nextValue)
  render()
}

document.addEventListener('DOMContentLoaded', () => {
  const whatsappUrl = 'https://chat.whatsapp.com/GZYt43LWzdd8TcD591s10s?mode=gi_t';
  const headerLink = document.getElementById('whatsapp-link-header');
  const footerLink = document.getElementById('whatsapp-link-footer');
  if (headerLink) headerLink.href = whatsappUrl;
  if (footerLink) footerLink.href = whatsappUrl;
});
