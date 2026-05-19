import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://fdzmyslbuyawdzmdaqta.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_4vpA_eivt39tgIBY_SKvMA_b7-wxUoc'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const STORAGE_PREFIX = 'gather-june-2026:'
const DRAFT_STORAGE_KEY = STORAGE_PREFIX + 'drafts'
const ACTIVITY_TITLE_PREFIX = 'activity_title:'

const drafts = loadDrafts()
const editStatus = {}

const state = {
  data: {},
  expandedDays: new Set(),
  currentView: 'schedule',
  searchQuery: '',
  hasDraftEdits: Object.keys(drafts).length > 0,
  session: null,
  userEmail: '',
}

const el = {
  title: document.getElementById('app-title'),
  subtitle: document.getElementById('app-subtitle'),
  mapLink: document.getElementById('map-link'),
  statusStrip: document.getElementById('status-strip'), // legacy, not used
  // footerStatus: document.getElementById('footer-status'), // replaced with lazy lookup
  skeleton: document.getElementById('skeleton'),
  content: document.getElementById('content'),
  accordionRoot: document.getElementById('accordion-root'),
  navTabs: document.querySelectorAll('.nav-tab'),
  navHamburger: document.getElementById('nav-hamburger'),
  navTabList: document.getElementById('nav-tab-list'),
  navActiveLabel: document.getElementById('nav-active-label'),
  navTabsContainer: document.getElementById('nav-tabs'),
  assignmentSearch: document.getElementById('assignment-search'),
  assignmentsList: document.getElementById('assignments-list'),
  foodContent: document.getElementById('food-content'),
  systemContent: document.getElementById('system-content'),
  systemTab: document.querySelector('.nav-tab[data-view="system"]'),
}

bootstrap()

window.addEventListener('online', () => render())
window.addEventListener('offline', () => render())

async function bootstrap() {
  await initializeAuth()

  const site = await loadSiteMetadata()
  const assignments = await loadAssignments()
  const schedule = await loadSchedule()
  const food = await loadFood()

  state.data.site = site
  state.data.assignments = assignments
  state.data.schedule = schedule
  state.data.food = food

  state.hasDraftEdits = Object.keys(drafts).length > 0
  el.skeleton.classList.add('hidden')
  bindNavHandlers()
  bindSearchHandler()
  bindAccordionHandlers()
  showMainView()
}

function canEdit() {
  return Boolean(state.session)
}

async function initializeAuth() {
  const { data, error } = await supabase.auth.getSession()
  if (!error) {
    state.session = data?.session || null
    state.userEmail = state.session?.user?.email || ''
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session || null
    state.userEmail = state.session?.user?.email || ''
    render()
  })
}

function bindNavHandlers() {
  el.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const view = tab.dataset.view
      closeNavMenu()
      switchView(view)
    })
  })

  if (el.navHamburger) {
    el.navHamburger.addEventListener('click', (e) => {
      e.stopPropagation()
      const isOpen = el.navTabsContainer.classList.toggle('is-open')
      el.navHamburger.setAttribute('aria-expanded', String(isOpen))
    })
  }

  document.addEventListener('click', (e) => {
    if (el.navTabsContainer && !el.navTabsContainer.contains(e.target)) {
      closeNavMenu()
    }
  })
}

function closeNavMenu() {
  if (el.navTabsContainer) {
    el.navTabsContainer.classList.remove('is-open')
    if (el.navHamburger) el.navHamburger.setAttribute('aria-expanded', 'false')
  }
}

function bindSearchHandler() {
  el.assignmentSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase()
    renderAssignments()
  })
}

function switchView(viewName) {
  if (viewName === 'system' && !canEdit()) {
    viewName = 'schedule'
  }

  state.currentView = viewName

  // Update nav tabs
  el.navTabs.forEach((tab) => {
    if (tab.dataset.view === viewName) {
      tab.classList.add('is-active')
      if (el.navActiveLabel) el.navActiveLabel.textContent = tab.textContent
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

function syncSystemTabVisibility() {
  const canSeeSystem = canEdit()
  if (el.systemTab) {
    el.systemTab.classList.toggle('hidden', !canSeeSystem)
  }

  if (!canSeeSystem && state.currentView === 'system') {
    switchView('schedule')
    return true
  }

  return false
}

async function loadSiteMetadata() {
  try {
    const { data, error } = await supabase
      .from('site_metadata')
      .select('title, subtitle, date_start, date_end, location_name, address_line1, address_line2, map_open_url, map_embed_url, updated_at')
      .eq('id', 1)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      throw new Error('No site metadata row found')
    }

    const row = data[0]

    return {
      content: {
        title: row.title,
        subtitle: row.subtitle || '',
        dateRange: {
          start: row.date_start,
          end: row.date_end,
        },
        location: {
          name: row.location_name,
          addressLine1: row.address_line1,
          addressLine2: row.address_line2,
          mapOpenUrl: row.map_open_url,
          mapEmbedUrl: row.map_embed_url,
        },
      },
      source: 'network',
    }
  } catch (error) {
    throw new Error('Failed to load site metadata: ' + (error?.message ?? String(error)))
  }
}

async function loadAssignments() {
  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('id, day, type, assignee, note')
      .order('day', { ascending: true })
      .order('type', { ascending: true })

    if (error) {
      throw error
    }

    return {
      content: {
        entries: (data || []).map((entry) => ({
          ...entry,
          activity_title: extractActivityTitle(entry.note),
        })),
      },
      source: 'network',
    }
  } catch (error) {
    throw new Error('Failed to load assignments: ' + (error?.message ?? String(error)))
  }
}

async function loadSchedule() {
  try {
    const [{ data: days, error: daysError }, { data: items, error: itemsError }] = await Promise.all([
      supabase
        .from('schedule_days')
        .select('id, day_date, label, short_label')
        .order('day_date', { ascending: true }),
      supabase
        .from('schedule_items')
        .select('id, schedule_day_id, item_order, time, title, note')
        .order('item_order', { ascending: true }),
    ])

    if (daysError) throw daysError
    if (itemsError) throw itemsError

    const itemsByDayId = new Map()
    for (const item of items || []) {
      if (!itemsByDayId.has(item.schedule_day_id)) {
        itemsByDayId.set(item.schedule_day_id, [])
      }
      itemsByDayId.get(item.schedule_day_id).push({
        id: item.id,
        itemOrder: item.item_order,
        time: item.time,
        title: item.title,
        note: item.note,
      })
    }

    return {
      content: {
        days: (days || []).map((day) => ({
          id: day.id,
          date: day.day_date,
          label: day.label,
          shortLabel: day.short_label,
          timeline: itemsByDayId.get(day.id) || [],
        })),
      },
      source: 'network',
    }
  } catch (error) {
    throw new Error('Failed to load schedule: ' + (error?.message ?? String(error)))
  }
}

async function loadFood() {
  try {
    const { data, error } = await supabase
      .from('food_metadata')
      .select('summary, shopping_doc_url, allergies, kitchen_notes, extra_requests, updated_at')
      .eq('id', 1)
      .order('updated_at', { ascending: false })
      .limit(1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      throw new Error('No food metadata row found')
    }

    const row = data[0]

    return {
      content: {
        summary: row.summary,
        shoppingDocUrl: row.shopping_doc_url,
        allergies: row.allergies || [],
        kitchenNotes: row.kitchen_notes || [],
        extraRequests: row.extra_requests || [],
      },
      source: 'network',
    }
  } catch (error) {
    throw new Error('Failed to load food metadata: ' + (error?.message ?? String(error)))
  }
}

function showMainView() {
  // el.statusStrip is legacy, not used
  const content = document.getElementById('content')
  if (content) content.classList.remove('hidden')
  render()
}


function render() {
  if (syncSystemTabVisibility()) {
    return
  }

  renderFooterStatus()

  const hasCoreData = state.data.site && state.data.assignments && state.data.schedule && state.data.food
  if (!hasCoreData) {
    return
  }

  if (state.currentView === 'schedule') {
    renderAccordion()
  } else if (state.currentView === 'assignments') {
    renderAssignments()
  } else if (state.currentView === 'food') {
    renderFood()
  } else if (state.currentView === 'system') {
    renderSystem()
  }
}

function renderFooterStatus() {
  const parts = []

  if (!navigator.onLine) {
    parts.push('<span class="badge offline">Offline mode: showing last-loaded data</span>')
  }

  if (canEdit()) {
    const emailLabel = escapeHtml(state.userEmail || 'signed in user')
    parts.push('<span class="badge ok">Edit mode: ' + emailLabel + '</span>')
    parts.push('<button class="auth-action" type="button" data-auth-action="signout">Sign out</button>')
  } else {
    parts.push('<button class="auth-action auth-action-icon" type="button" data-auth-action="signin" aria-label="Sign in to edit" title="Sign in to edit"><span aria-hidden="true">&#128273;</span></button>')
  }

  const footerStatus = document.getElementById('footer-status')
  if (footerStatus) {
    footerStatus.innerHTML = parts.join(' ')
  }
}

function renderAccordion() {
  const site = state.data.site.content
  const schedule = state.data.schedule.content
  const assignments = state.data.assignments.content
  const locationName = site.location?.name || ''
  const mapOpenUrl = site.location?.mapOpenUrl || ''

  el.title.textContent = site.title

  // Calculate countdown
  const daysUntil = calculateDaysUntil(site.dateRange.start)
  if (daysUntil > 0) {
    el.subtitle.textContent = 'in ' + daysUntil + ' day' + (daysUntil === 1 ? '' : 's')
  } else {
    el.subtitle.textContent = 'Gather in progress!'
  }

  // Set map link
  if (mapOpenUrl) {
    el.mapLink.href = mapOpenUrl
    el.mapLink.textContent = 'Link to Map of ' + (locationName || 'Location')
  } else {
    el.mapLink.href = '#'
    el.mapLink.textContent = 'Add map link'
  }

  let html = ''

  for (const day of schedule.days) {
    const isExpanded = state.expandedDays.has(day.date)
    const dayAssignments = assignments.entries.filter((entry) => entry.day === day.date)

    html += '<div class="accordion-day ' + (isExpanded ? 'is-expanded' : '') + '" data-date="' + escapeHtml(day.date) + '">'
    const dayLabelPath = 'schedule.days.' + day.date + '.label'
    const dayLabelValue = getEditableValue(dayLabelPath, day.label || '')
    html += '<button class="accordion-header" type="button">' + renderEditableText(dayLabelPath, dayLabelValue, 'Add day label', 'inline-day-label') + '</button>'
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
        html += '<strong>' + renderEditableText(itemPath + '.title', title, 'Untitled item', 'inline-schedule-title') + '</strong>'
        if (hasTime) {
          html += ' <span class="activity-time">' + renderEditableText(itemPath + '.time', time, 'Add time', 'inline-schedule-time') + '</span>'
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
    header.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.inline-edit[contenteditable="true"]')) {
        return
      }
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
  const scheduleDays = state.data.schedule?.content?.days || assignments.days || []
  for (const dayInfo of scheduleDays) {
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
  if (food.summary) {
    html += '<p>' + escapeHtml(food.summary) + '</p>'
  }

  if (food.shoppingDocUrl) {
    html += `<p><a href="${escapeHtml(food.shoppingDocUrl)}" target="_blank" style="color: var(--text); text-decoration: underline; font-weight: 500;">Open Shopping List (Google Doc)</a></p>`
  }

  if (food.allergies && food.allergies.length > 0) {
    html += '<h3 style="margin-top: 1.5rem;">Allergies & Dietary Notes</h3>'
    html += '<ul style="margin: 0.5rem 0 0 1.5rem;">'
    for (const allergy of food.allergies) {
      html += '<li>' + escapeHtml(allergy) + '</li>'
    }
    html += '</ul>'
  }

  if (food.kitchenNotes && food.kitchenNotes.length > 0) {
    html += '<h3 style="margin-top: 1.5rem;">Kitchen Notes</h3>'
    html += '<ul style="margin: 0.5rem 0 0 1.5rem;">'
    for (const note of food.kitchenNotes) {
      html += '<li>' + escapeHtml(note) + '</li>'
    }
    html += '</ul>'
  }

  if (food.extraRequests && food.extraRequests.length > 0) {
    html += '<h3 style="margin-top: 1.5rem;">Extra Requests</h3>'
    html += '<ul style="margin: 0.5rem 0 0 1.5rem;">'
    for (const request of food.extraRequests) {
      html += '<li>' + escapeHtml(request) + '</li>'
    }
    html += '</ul>'
  }

  html += '</div>'

  el.foodContent.innerHTML = html
}

function renderSystem() {
  const site = state.data.site.content
  const food = state.data.food.content

  const title = getEditableValue('site.title', site.title || '')
  const locationName = getEditableValue('site.location.name', site.location?.name || '')
  const addressLine1 = getEditableValue('site.location.addressLine1', site.location?.addressLine1 || '')
  const addressLine2 = getEditableValue('site.location.addressLine2', site.location?.addressLine2 || '')
  const mapOpenUrl = getEditableValue('site.location.mapOpenUrl', site.location?.mapOpenUrl || '')
  const foodSummary = getEditableValue('food.summary', food.summary || '')

  let html = '<div class="system-view">'
  html += '<h2>System Settings</h2>'
  html += '<div class="system-panel">'
  html += '<h3>Site Metadata</h3>'
  html += '<p><strong>Title:</strong> ' + renderEditableText('site.title', title, 'Add title', 'inline-site-title') + '</p>'
  html += '<p><strong>Location:</strong> ' + renderEditableText('site.location.name', locationName, 'Add location name', 'inline-site-location') + '</p>'
  html += '<p><strong>Address:</strong> ' + renderEditableText('site.location.addressLine1', addressLine1, 'Add address line 1', 'inline-site-address') + ' ' + renderEditableText('site.location.addressLine2', addressLine2, 'Add address line 2', 'inline-site-address') + '</p>'
  html += '<p><strong>Map URL:</strong> ' + renderEditableText('site.location.mapOpenUrl', mapOpenUrl, 'Add map url', 'inline-site-map') + '</p>'
  html += '</div>'

  html += '<div class="system-panel">'
  html += '<h3>Food Metadata</h3>'
  html += '<p><strong>Summary:</strong> ' + renderEditableText('food.summary', foodSummary, 'Add summary', 'inline-food-summary') + '</p>'

  if (food.allergies && food.allergies.length > 0) {
    html += '<h4>Allergies</h4>'
    html += '<ul>'
    for (const [index, allergy] of food.allergies.entries()) {
      html += '<li>' + renderEditableText('food.allergies.' + index, allergy, 'Add allergy note', 'inline-food-item') + '</li>'
    }
    html += '</ul>'
  }

  if (food.kitchenNotes && food.kitchenNotes.length > 0) {
    html += '<h4>Kitchen Notes</h4>'
    html += '<ul>'
    for (const [index, note] of food.kitchenNotes.entries()) {
      html += '<li>' + renderEditableText('food.kitchenNotes.' + index, note, 'Add kitchen note', 'inline-food-item') + '</li>'
    }
    html += '</ul>'
  }

  if (food.extraRequests && food.extraRequests.length > 0) {
    html += '<h4>Extra Requests</h4>'
    html += '<ul>'
    for (const [index, request] of food.extraRequests.entries()) {
      html += '<li>' + renderEditableText('food.extraRequests.' + index, request, 'Add extra request', 'inline-food-item') + '</li>'
    }
    html += '</ul>'
  }

  html += '</div>'
  html += '</div>'

  el.systemContent.innerHTML = html
  bindEditableFields()
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

function clearDraftValue(path) {
  if (!Object.prototype.hasOwnProperty.call(drafts, path)) return
  delete drafts[path]
  saveDrafts()
}

function setEditStatus(path, status) {
  if (!path) return

  if (!status) {
    delete editStatus[path]
    return
  }

  editStatus[path] = status
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

function extractActivityTitle(note) {
  const raw = String(note || '')
  if (!raw.startsWith(ACTIVITY_TITLE_PREFIX)) return ''
  return raw.slice(ACTIVITY_TITLE_PREFIX.length).trim()
}

async function persistEditableValue(path, value) {
  const normalized = String(value ?? '').trim()

  try {
    const assignmentMatch = path.match(/^assignments\.entries\.([^.]+)\.(assignee|activity_title)$/)
    if (assignmentMatch) {
      const assignmentId = assignmentMatch[1]
      const field = assignmentMatch[2]
      const assignment = state.data.assignments?.content?.entries?.find((entry) => entry.id === assignmentId)

      if (!assignment) {
        throw new Error('Assignment not found for path: ' + path)
      }

      if (field === 'assignee') {
        const nextAssignee = normalized || 'TBD'
        const { error } = await supabase
          .from('assignments')
          .update({ assignee: nextAssignee })
          .eq('id', assignmentId)

        if (error) throw error
        assignment.assignee = nextAssignee
        return true
      }

      if (field === 'activity_title') {
        const noteValue = normalized ? ACTIVITY_TITLE_PREFIX + normalized : null
        const { error } = await supabase
          .from('assignments')
          .update({ note: noteValue })
          .eq('id', assignmentId)

        if (error) throw error
        assignment.activity_title = normalized
        assignment.note = noteValue
        return true
      }
    }

    const scheduleMatch = path.match(/^schedule\.days\.([^.]+)\.timeline\.(\d+)\.(title|time|note)$/)
    if (scheduleMatch) {
      const dayDate = scheduleMatch[1]
      const itemIndex = Number(scheduleMatch[2])
      const field = scheduleMatch[3]
      const day = state.data.schedule?.content?.days?.find((entry) => entry.date === dayDate)
      const item = day?.timeline?.[itemIndex]

      if (!item || !item.id) {
        throw new Error('Schedule item not found for path: ' + path)
      }

      const payload = {}
      payload[field] = normalized || null

      const { error } = await supabase
        .from('schedule_items')
        .update(payload)
        .eq('id', item.id)

      if (error) throw error
      item[field] = normalized
      return true
    }

    const dayLabelMatch = path.match(/^schedule\.days\.([^.]+)\.(label)$/)
    if (dayLabelMatch) {
      const dayDate = dayLabelMatch[1]
      const day = state.data.schedule?.content?.days?.find((entry) => entry.date === dayDate)
      if (!day) {
        throw new Error('Schedule day not found for path: ' + path)
      }

      const nextLabel = normalized || day.label || dayDate
      const { error } = await supabase
        .from('schedule_days')
        .update({ label: nextLabel })
        .eq('day_date', dayDate)

      if (error) throw error
      day.label = nextLabel
      return true
    }

    const siteMatch = path.match(/^site\.(title|location\.name|location\.addressLine1|location\.addressLine2|location\.mapOpenUrl)$/)
    if (siteMatch) {
      const site = state.data.site?.content
      if (!site) {
        throw new Error('Site metadata missing in state')
      }

      const updates = {}
      if (path === 'site.title') {
        updates.title = normalized || site.title
      } else if (path === 'site.location.name') {
        updates.location_name = normalized || site.location.name
      } else if (path === 'site.location.addressLine1') {
        updates.address_line1 = normalized || site.location.addressLine1
      } else if (path === 'site.location.addressLine2') {
        updates.address_line2 = normalized
      } else if (path === 'site.location.mapOpenUrl') {
        updates.map_open_url = normalized || site.location.mapOpenUrl
      }

      const { error } = await supabase
        .from('site_metadata')
        .update(updates)
        .eq('id', 1)

      if (error) throw error

      if (path === 'site.title') site.title = updates.title
      if (path === 'site.location.name') site.location.name = updates.location_name
      if (path === 'site.location.addressLine1') site.location.addressLine1 = updates.address_line1
      if (path === 'site.location.addressLine2') site.location.addressLine2 = updates.address_line2
      if (path === 'site.location.mapOpenUrl') site.location.mapOpenUrl = updates.map_open_url
      return true
    }

    const foodSummaryMatch = path.match(/^food\.(summary)$/)
    if (foodSummaryMatch) {
      const food = state.data.food?.content
      if (!food) {
        throw new Error('Food metadata missing in state')
      }

      const nextSummary = normalized || food.summary
      const { error } = await supabase
        .from('food_metadata')
        .update({ summary: nextSummary })
        .eq('id', 1)

      if (error) throw error
      food.summary = nextSummary
      return true
    }

    const foodListMatch = path.match(/^food\.(allergies|kitchenNotes|extraRequests)\.(\d+)$/)
    if (foodListMatch) {
      const listName = foodListMatch[1]
      const index = Number(foodListMatch[2])
      const food = state.data.food?.content
      if (!food) {
        throw new Error('Food metadata missing in state')
      }

      const dbColumn = listName === 'allergies'
        ? 'allergies'
        : listName === 'kitchenNotes'
          ? 'kitchen_notes'
          : 'extra_requests'

      const nextList = [...(food[listName] || [])]
      nextList[index] = normalized || nextList[index] || ''

      const { error } = await supabase
        .from('food_metadata')
        .update({ [dbColumn]: nextList })
        .eq('id', 1)

      if (error) throw error
      food[listName] = nextList
      return true
    }

    return false
  } catch (error) {
    console.error('Failed to persist edit for path', path, error)
    return false
  }
}

function renderEditableText(path, value, placeholder, extraClass = '') {
  const resolved = String(value ?? '').trim()
  const isPlaceholder = resolved.length === 0
  const text = isPlaceholder ? placeholder : resolved
  const statusClass = editStatus[path] ? 'is-' + editStatus[path] : ''
  const className = ['inline-edit', extraClass, isPlaceholder ? 'is-placeholder' : '', statusClass, canEdit() ? '' : 'is-readonly']
    .filter(Boolean)
    .join(' ')
  const editable = canEdit() ? 'true' : 'false'

  return '<span class="' + className + '" contenteditable="' + editable + '" spellcheck="false" data-edit-path="' + escapeHtml(path) + '" data-placeholder="' + escapeHtml(placeholder) + '" data-original-text="' + escapeHtml(text) + '">' + escapeHtml(text) + '</span>'
}

function renderAssignmentDetails(assignment, contextTitle = '') {
  const type = String(assignment.type || '').toLowerCase()
  const title = String(contextTitle || '').toLowerCase()
  const assigneePath = 'assignments.entries.' + assignment.id + '.assignee'
  const assigneeValue = getEditableValue(assigneePath, assignment.assignee === 'TBD' ? '' : assignment.assignee)
  const assigneePlaceholder = canEdit() ? 'Add assignee' : 'TBD'

  if (type.includes('cleanup')) {
    return '<div class="assignment-detail assignment-detail--single"><span class="assignment-label">Cleanup Crew</span>' + renderEditableText(assigneePath, assigneeValue, assigneePlaceholder, 'inline-assignee') + '</div>'
  }

  if (type.includes('activity')) {
    const activityTitlePath = 'assignments.entries.' + assignment.id + '.activity_title'
    const activityTitleValue = getEditableValue(activityTitlePath, '')

    return [
      '<div class="assignment-detail assignment-detail--stacked">',
      '<div class="assignment-detail-row">',
      '<span class="assignment-label">Activity title</span>',
      renderEditableText(activityTitlePath, activityTitleValue, canEdit() ? 'Add activity title' : 'TBD', 'inline-assignment-title'),
      '</div>',
      '<div class="assignment-detail-row">',
      '<span class="assignment-label">Lead</span>',
      renderEditableText(assigneePath, assigneeValue, assigneePlaceholder, 'inline-assignee'),
      '</div>',
      '</div>',
    ].join('')
  }

  if (title.includes('lunch')) {
    return renderEditableText(assigneePath, assigneeValue, assigneePlaceholder, 'inline-assignee') + ' - ' + escapeHtml(assignment.type)
  }

  return renderEditableText(assigneePath, assigneeValue, assigneePlaceholder, 'inline-assignee')
}

function renderHangoutPrompt() {
  const whatsappIcon = './assets/whatsapp-glyph-green.svg';
  const whatsappUrl = 'https://chat.whatsapp.com/GZYt43LWzdd8TcD591s10s?mode=gi_t';

  return [
    '<div class="hangout-prompt">',
    '<a href="' + whatsappUrl + '" target="_blank" rel="noopener" class="hangout-prompt__link">',
    '<img class="hangout-prompt__icon" src="' + whatsappIcon + '" alt="WhatsApp" width="24" height="24" />',
    '<span class="hangout-prompt__text"><strong>Share pictures!</strong> Tell us what you\'re doing!</span>',
    '</a>',
    '</div>',
  ].join('');
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
  if (!canEdit()) return

  const field = event.currentTarget

  if (field.classList.contains('is-placeholder')) {
    field.textContent = ''
    field.classList.remove('is-placeholder')
  }

  field.dataset.originalText = field.textContent || ''
  field.dataset.editCanceled = 'false'
}

function handleEditableKeydown(event) {
  if (!canEdit()) return

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

async function handleEditableBlur(event) {
  if (!canEdit()) return

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

  setEditStatus(path, 'saving')
  render()

  const saved = await persistEditableValue(path, nextValue)
  if (saved) {
    clearDraftValue(path)
    setEditStatus(path, 'saved')
    render()
    setTimeout(() => {
      if (editStatus[path] === 'saved') {
        setEditStatus(path, null)
        render()
      }
    }, 1200)
  } else {
    setDraftValue(path, nextValue)
    setEditStatus(path, 'error')
    render()
    setTimeout(() => {
      if (editStatus[path] === 'error') {
        setEditStatus(path, null)
        render()
      }
    }, 2000)
  }
}

async function requestMagicLinkSignIn() {
  const email = window.prompt('Enter your email to receive a magic sign-in link:')
  const normalizedEmail = String(email || '').trim()
  if (!normalizedEmail) return

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: window.location.href,
    },
  })

  if (error) {
    window.alert('Sign-in failed: ' + error.message)
    return
  }

  window.alert('Magic link sent. Check your email to sign in.')
}

async function handleAuthActionClick(event) {
  const actionButton = event.target instanceof Element ? event.target.closest('[data-auth-action]') : null
  if (!actionButton) return

  const action = actionButton.getAttribute('data-auth-action')
  if (action === 'signin') {
    await requestMagicLinkSignIn()
    return
  }

  if (action === 'signout') {
    const { error } = await supabase.auth.signOut()
    if (error) {
      window.alert('Sign-out failed: ' + error.message)
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const whatsappUrl = 'https://chat.whatsapp.com/GZYt43LWzdd8TcD591s10s?mode=gi_t';
  const headerLink = document.getElementById('whatsapp-link-header');
  const footerLink = document.getElementById('whatsapp-link-footer');
  document.addEventListener('click', handleAuthActionClick)
  if (headerLink) headerLink.href = whatsappUrl;
  if (footerLink) footerLink.href = whatsappUrl;
  showMainView();
});
