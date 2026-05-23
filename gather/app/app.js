import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://fdzmyslbuyawdzmdaqta.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_4vpA_eivt39tgIBY_SKvMA_b7-wxUoc'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const STORAGE_PREFIX = 'gather-june-2026:'
const DRAFT_STORAGE_KEY = STORAGE_PREFIX + 'drafts'
const SIMULATED_AUTH_KEY = STORAGE_PREFIX + 'simulated-auth'
const ACTIVITY_ATTACHMENTS_BUCKET = 'attachments'

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
  simulatedAuth: false,
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
  const schedule = await loadSchedule()
  const activityAssignments = await loadActivityAssignments()
  const food = await loadFood()

  state.data.site = site
  state.data.schedule = schedule
  state.data.activityAssignments = activityAssignments
  state.data.food = food

  state.hasDraftEdits = Object.keys(drafts).length > 0
  el.skeleton.classList.add('hidden')
  bindNavHandlers()
  bindSearchHandler()
  bindAccordionHandlers()
  showMainView()
}

function canEdit() {
  return Boolean(state.session || state.simulatedAuth)
}

function isLocalDevelopmentHost() {
  const hostname = window.location.hostname
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function syncSimulatedAuthFromUrl() {
  if (!isLocalDevelopmentHost()) {
    return
  }

  const params = new URLSearchParams(window.location.search)
  const simulateValue = params.get('simulateAuth')
  if (simulateValue === '1') {
    localStorage.setItem(SIMULATED_AUTH_KEY, '1')
  } else if (simulateValue === '0') {
    localStorage.removeItem(SIMULATED_AUTH_KEY)
  }
}

function applySimulatedAuthState() {
  if (!isLocalDevelopmentHost()) {
    state.simulatedAuth = false
    return
  }

  state.simulatedAuth = localStorage.getItem(SIMULATED_AUTH_KEY) === '1'
}

function clearSimulatedAuthState() {
  localStorage.removeItem(SIMULATED_AUTH_KEY)
  state.simulatedAuth = false
}

async function initializeAuth() {
  syncSimulatedAuthFromUrl()
  applySimulatedAuthState()

  const { data, error } = await supabase.auth.getSession()
  if (!error) {
    state.session = data?.session || null
    if (state.session) {
      state.userEmail = state.session?.user?.email || ''
    } else if (state.simulatedAuth) {
      state.userEmail = 'simulated@localhost'
    } else {
      state.userEmail = ''
    }
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session || null
    applySimulatedAuthState()
    if (state.session) {
      state.userEmail = state.session?.user?.email || ''
    } else if (state.simulatedAuth) {
      state.userEmail = 'simulated@localhost'
    } else {
      state.userEmail = ''
    }
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

async function loadSchedule() {
  try {
    const { data: days, error: daysError } = await supabase
      .from('schedule_days')
      .select('id, day_date, label, short_label')
      .order('day_date', { ascending: true })

    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('id, schedule_day_id, sequence, title, time, note, assignment, link, attachment_path')
      .order('sequence', { ascending: true })

    if (daysError) throw daysError
    if (activitiesError) throw activitiesError

    const activitiesByDayId = new Map()
    for (const activity of activities || []) {
      if (!activitiesByDayId.has(activity.schedule_day_id)) {
        activitiesByDayId.set(activity.schedule_day_id, [])
      }
      activitiesByDayId.get(activity.schedule_day_id).push({
        id: activity.id,
        sequence: activity.sequence,
        title: activity.title,
        time: activity.time,
        note: activity.note,
        assignment: activity.assignment,
        link: activity.link,
        attachmentPath: activity.attachment_path,
      })
    }

    return {
      content: {
        days: (days || []).map((day) => ({
          id: day.id,
          date: day.day_date,
          label: day.label,
          shortLabel: day.short_label,
          activities: activitiesByDayId.get(day.id) || [],
        })),
      },
      source: 'network',
    }
  } catch (error) {
    throw new Error('Failed to load schedule: ' + (error?.message ?? String(error)))
  }
}

async function loadActivityAssignments() {
  try {
    const [{ data: activities, error: activitiesError }, { data: days, error: daysError }] = await Promise.all([
      supabase
        .from('activities')
        .select('id, schedule_day_id, title, assignment, sequence')
        .order('sequence', { ascending: true }),
      supabase
        .from('schedule_days')
        .select('id, day_date, label')
        .order('day_date', { ascending: true }),
    ])

    if (activitiesError) throw activitiesError
    if (daysError) throw daysError

    const dayLabels = new Map((days || []).map((day) => [day.id, day.label || day.day_date]))

    return {
      content: {
        entries: (activities || []).map((activity) => ({
          id: activity.id,
          dayId: activity.schedule_day_id,
          dayLabel: dayLabels.get(activity.schedule_day_id) || '',
          title: activity.title || '(untitled)',
          assignment: String(activity.assignment || '').trim(),
          sequence: activity.sequence || 0,
        })),
      },
      source: 'network',
    }
  } catch (error) {
    throw new Error('Failed to load activity assignments: ' + (error?.message ?? String(error)))
  }
}

async function loadFood() {
  try {
    const { data, error } = await supabase
      .from('food_metadata')
      .select('title, summary, shopping_doc_url, allergies, kitchen_notes, extra_requests, allergies_heading, kitchen_notes_heading, extra_requests_heading, updated_at')
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
        title: row.title || 'Food & Meal Planning',
        summary: row.summary,
        shoppingDocUrl: row.shopping_doc_url,
        allergies: row.allergies || [],
        kitchenNotes: row.kitchen_notes || [],
        extraRequests: row.extra_requests || [],
        allergiesHeading: row.allergies_heading || 'Allergies & Dietary Notes',
        kitchenNotesHeading: row.kitchen_notes_heading || 'Kitchen Notes',
        extraRequestsHeading: row.extra_requests_heading || 'Extra Requests',
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

  const hasCoreData = state.data.site && state.data.schedule && state.data.food
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
    const modeLabel = state.simulatedAuth && !state.session ? 'Edit mode (simulated): ' : 'Edit mode: '
    parts.push('<span class="badge ok">' + modeLabel + emailLabel + '</span>')
    parts.push('<button class="auth-action" type="button" data-auth-action="signout">Sign out</button>')
  } else {
    parts.push('<button class="auth-action auth-action-icon" type="button" data-auth-action="signin" aria-label="Sign in to edit" title="Sign in to edit"><span aria-hidden="true">○</span></button>')
  }

  const footerStatus = document.getElementById('footer-status')
  if (footerStatus) {
    footerStatus.innerHTML = parts.join(' ')
  }
}

function renderAccordion() {
  const site = state.data.site.content
  const schedule = state.data.schedule.content
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
    const dayActivities = getSortedActivities(day.activities)

    html += '<div class="accordion-day ' + (isExpanded ? 'is-expanded' : '') + '" data-date="' + escapeHtml(day.date) + '">'
    const dayLabelPath = 'schedule.days.' + day.date + '.label'
    const dayLabelValue = getEditableValue(dayLabelPath, day.label || '')
    html += '<button class="accordion-header" type="button">' + renderEditableText(dayLabelPath, dayLabelValue, 'Add day label', 'inline-day-label') + '</button>'
    html += '<div class="accordion-content">'
    html += '<div class="accordion-body">'

    html += '<div class="activities-section">'

    if (dayActivities.length > 0) {
      for (const activity of dayActivities) {
        html += renderActivityCard(day.date, dayActivities, activity)
      }
    }

    html += renderActivityCreateForm(day.date, dayActivities)
    html += '</div>'

    html += '</div>' // accordion-body
    html += '</div>' // accordion-content
    html += '</div>' // accordion-day
  }

  el.accordionRoot.innerHTML = html
  bindAccordionHandlers()
  bindEditableFields()
  bindActivityControls()
}

function getSortedActivities(activities) {
  return [...(activities || [])].sort((a, b) => a.sequence - b.sequence || String(a.id).localeCompare(String(b.id)))
}

function findActivityContextById(activityId) {
  const days = state.data.schedule?.content?.days || []
  for (const day of days) {
    const activity = (day.activities || []).find((entry) => entry.id === activityId)
    if (activity) {
      return { day, activity }
    }
  }

  return { day: null, activity: null }
}

function buildSequenceOptions(dayActivities, currentActivityId = null) {
  const referenceActivities = currentActivityId
    ? dayActivities.filter((activity) => activity.id !== currentActivityId)
    : [...dayActivities]
  const slotCount = referenceActivities.length + 1
  const options = []

  for (let position = 1; position <= slotCount; position += 1) {
    const before = position > 1 ? referenceActivities[position - 2] : null
    const after = position <= referenceActivities.length ? referenceActivities[position - 1] : null
    let label = 'At the end'

    if (!before && after) {
      label = 'Before ' + (after.title || 'Untitled activity')
    } else if (before && !after) {
      label = 'After ' + (before.title || 'Untitled activity')
    } else if (before && after) {
      label = 'Between ' + (before.title || 'Untitled activity') + ' and ' + (after.title || 'Untitled activity')
    } else if (!before && !after) {
      label = 'At the top'
    }

    options.push({ value: String(position), label })
  }

  return options
}

function renderSelectOptions(options, selectedValue) {
  return options.map((option) => {
    const isSelected = String(option.value) === String(selectedValue)
    return '<option value="' + escapeHtml(option.value) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(option.label) + '</option>'
  }).join('')
}

function renderSequenceSelect(dayActivities, activity) {
  const options = buildSequenceOptions(dayActivities, activity.id)
  const disabledAttr = canEdit() ? '' : ' disabled'
  return '<select class="activity-select activity-select--sequence" data-edit-path="activities.entries.' + escapeHtml(activity.id) + '.sequence"' + disabledAttr + '>' + renderSelectOptions(options, String(activity.sequence || 1)) + '</select>'
}

function normalizeExternalUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) return raw
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return 'https://' + raw
  return ''
}

function getAttachmentFileName(pathValue) {
  const raw = String(pathValue || '').trim()
  if (!raw) return ''
  const parts = raw.split('/')
  return parts[parts.length - 1] || raw
}

function getAttachmentPublicUrl(pathValue) {
  const raw = String(pathValue || '').trim()
  if (!raw) return ''
  const { data } = supabase.storage.from(ACTIVITY_ATTACHMENTS_BUCKET).getPublicUrl(raw)
  return data?.publicUrl || ''
}

function sanitizeAttachmentFileName(fileName) {
  return String(fileName || 'attachment')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
}

function renderLinkField(linkPath, linkValue) {
  const editable = renderEditableText(linkPath, linkValue, 'Add link', 'inline-activity-link')
  const normalized = normalizeExternalUrl(linkValue)
  if (!normalized) {
    return editable
  }

  return [
    editable,
    '<a class="activity-inline-link" href="' + escapeHtml(normalized) + '" target="_blank" rel="noopener">Open link</a>',
  ].join('')
}

function renderAttachmentField(activity) {
  const currentPath = activity.attachmentPath || ''
  const fileName = getAttachmentFileName(currentPath)
  const publicUrl = getAttachmentPublicUrl(currentPath)
  const statusPath = 'activities.entries.' + activity.id + '.attachment_path'
  const statusClass = editStatus[statusPath] ? ' is-' + editStatus[statusPath] : ''

  const parts = []
  parts.push('<div class="activity-attachment-control' + statusClass + '">')
  if (publicUrl) {
    parts.push('<a class="activity-inline-link" href="' + escapeHtml(publicUrl) + '" target="_blank" rel="noopener">' + escapeHtml(fileName || 'Open attachment') + '</a>')
    parts.push('<button type="button" class="activity-attachment-clear" data-attachment-clear-id="' + escapeHtml(activity.id) + '">Remove</button>')
  }
  parts.push('<input class="activity-attachment-input" type="file" data-activity-id="' + escapeHtml(activity.id) + '" />')
  parts.push('<div class="activity-attachment-hint">Uploads to Supabase Storage</div>')
  parts.push('</div>')

  return parts.join('')
}

function renderActivityCard(dayDate, dayActivities, activity) {
  // View-only mode for non-authenticated users
  if (!canEdit()) {
    const detailsRow = [
      '<div class="activity-details-row">',
      activity.time ? '<span class="activity-detail activity-detail__title"><strong>' + escapeHtml(activity.time) + '</strong></span>' : '',
      '<span class="activity-detail activity-detail__title"><strong>' + escapeHtml(activity.title || 'Untitled') + '</strong></span>',
      activity.assignment ? '<span class="activity-detail">' + escapeHtml(activity.assignment) + '</span>' : '',
      activity.note ? '<span class="activity-detail">' + escapeHtml(activity.note) + '</span>' : '',
      '</div>'
    ].join('')

    const linkUrl = normalizeExternalUrl(activity.link)
    const attachmentUrl = getAttachmentPublicUrl(activity.attachmentPath)
    const belowRow = [
      '<div class="activity-details-below">',
      linkUrl ? '<span class="activity-detail-below"><span class="activity-label">Link:</span> <a class="activity-inline-link" href="' + escapeHtml(linkUrl) + '" target="_blank" rel="noopener">Open link</a></span>' : '',
      attachmentUrl ? '<span class="activity-detail-below"><span class="activity-label">Attachment:</span> <a class="activity-inline-link" href="' + escapeHtml(attachmentUrl) + '" target="_blank" rel="noopener">' + escapeHtml(getAttachmentFileName(activity.attachmentPath) || 'Open attachment') + '</a></span>' : '',
      '</div>'
    ].join('')

    return '<li class="activity-card">' + detailsRow + belowRow + '</li>'
  }

  // Edit mode for authenticated users
  const titlePath = 'activities.entries.' + activity.id + '.title'
  const timePath = 'activities.entries.' + activity.id + '.time'
  const notePath = 'activities.entries.' + activity.id + '.note'
  const linkPath = 'activities.entries.' + activity.id + '.link'
  const assignmentPath = 'activities.entries.' + activity.id + '.assignment'
  const title = getEditableValue(titlePath, activity.title || '')
  const time = getEditableValue(timePath, activity.time || '')
  const note = getEditableValue(notePath, activity.note || '')
  const link = getEditableValue(linkPath, activity.link || '')
  const assignment = getEditableValue(assignmentPath, activity.assignment || '')
  const deleteDisabledAttr = ''

  // Main details row
  const detailsRow = [
    '<div class="activity-details-row">',
    time ? '<span class="activity-detail activity-detail__title">' + renderEditableText(timePath, time, 'Add time', 'inline-activity-time') + '</span>' : '',
    '<span class="activity-detail activity-detail__title">' + renderEditableText(titlePath, title, 'Add title', 'inline-activity-title') + '</span>',
    '<span class="activity-detail">' + renderEditableText(assignmentPath, assignment, 'Add assignment', 'inline-activity-assignment') + '</span>',
    '<span class="activity-detail">' + renderEditableText(notePath, note, 'Add note', 'inline-activity-note') + '</span>',
    '<span class="activity-detail activity-detail__sequence">',
    renderSequenceSelect(dayActivities, activity),
    '</span>',
    '<button class="activity-delete-button" type="button" data-delete-activity-id="' + escapeHtml(activity.id) + '" data-day-date="' + escapeHtml(dayDate) + '"' + deleteDisabledAttr + '>Delete</button>',
    '</div>'
  ].join('')

  // Link and attachment below
  const belowRow = [
    '<div class="activity-details-below">',
    '<span class="activity-detail-below">' + renderLinkField(linkPath, link) + '</span>',
    '<span class="activity-detail-below">' + renderAttachmentField(activity) + '</span>',
    '</div>'
  ].join('')

  return [
    '<li class="activity-card" data-activity-id="' + escapeHtml(activity.id) + '">',
    detailsRow,
    belowRow,
    '</li>',
  ].join('')
}

function renderActivityCreateForm(dayDate, dayActivities) {
  const sequenceOptions = buildSequenceOptions(dayActivities);
  const disabledAttr = canEdit() ? '' : ' disabled';

  if (!canEdit()) {
    return '';
  }

  return [
    '<form class="activity-create-form" data-day-date="' + escapeHtml(dayDate) + '">', 
    '<h3>Add Activity</h3>',
    '<div class="activity-create-form__grid">',
    '<label><span class="activity-label">Title</span><input name="title" type="text" placeholder="Activity title" required' + disabledAttr + ' /></label>',
    '<label><span class="activity-label">Time</span><input name="time" type="text" placeholder="Optional time"' + disabledAttr + ' /></label>',
    '<label class="activity-create-form__wide"><span class="activity-label">Note</span><textarea name="note" rows="2" placeholder="Optional note"' + disabledAttr + '></textarea></label>',
    '<label><span class="activity-label">Assignment</span><input name="assignment" type="text" placeholder="Add assignment"' + disabledAttr + ' /></label>',
    '<label><span class="activity-label">Link</span><input name="link" type="text" placeholder="Optional URL"' + disabledAttr + ' /></label>',
    '<label class="activity-create-form__wide"><span class="activity-label">Attachment</span><input name="attachment_file" type="file"' + disabledAttr + ' /></label>',
    '<label><span class="activity-label">Sequence</span><select name="sequence"' + disabledAttr + '>' + renderSelectOptions(sequenceOptions, sequenceOptions.length ? sequenceOptions[sequenceOptions.length - 1].value : '1') + '</select></label>',
    '</div>',
    '<div class="activity-create-form__actions"><button type="submit"' + disabledAttr + '>Add activity</button></div>',
    '</form>',
  ].join('');
}

async function persistActivityOrder(day, orderedActivities) {
  const desiredOrder = orderedActivities.filter(Boolean)

  for (const [index, activity] of desiredOrder.entries()) {
    const { error } = await supabase
      .from('activities')
      .update({ sequence: -(index + 1) })
      .eq('id', activity.id)

    if (error) throw error
  }

  for (const [index, activity] of desiredOrder.entries()) {
    const nextSequence = index + 1
    const { error } = await supabase
      .from('activities')
      .update({ sequence: nextSequence })
      .eq('id', activity.id)

    if (error) throw error
    activity.sequence = nextSequence
  }

  day.activities = desiredOrder

  const cachedAssignments = state.data.activityAssignments?.content?.entries
  if (cachedAssignments) {
    for (const [index, activity] of desiredOrder.entries()) {
      const cachedAssignment = cachedAssignments.find((entry) => entry.id === activity.id)
      if (cachedAssignment) {
        cachedAssignment.sequence = index + 1
      }
    }
  }
}

async function handleActivityCreateSubmit(event) {
  event.preventDefault();
  if (!canEdit()) return;

  const form = event.currentTarget;
  const dayDate = form.dataset.dayDate;
  const day = state.data.schedule?.content?.days?.find((entry) => entry.date === dayDate);
  if (!day) return;

  const formData = new FormData(form);
  const title = String(formData.get('title') || '').trim();
  if (!title) return;

  const existingActivities = getSortedActivities(day.activities);
  const sequenceValue = Number(formData.get('sequence') || existingActivities.length + 1);
  const targetSequence = Math.max(1, Math.min(sequenceValue, existingActivities.length + 1));
  const assignmentValue = String(formData.get('assignment') || '').trim();
  const attachmentFile = formData.get('attachment_file');

  const insertPayload = {
    schedule_day_id: day.id,
    sequence: 0,
    title,
    time: String(formData.get('time') || '').trim() || null,
    note: String(formData.get('note') || '').trim() || null,
    assignment: assignmentValue || null,
    link: String(formData.get('link') || '').trim() || null,
    attachment_path: null,
  }

  const { data, error } = await supabase
    .from('activities')
    .insert(insertPayload)
    .select('id, schedule_day_id, sequence, title, time, note, assignment, link, attachment_path')
    .single();

  if (error) {
    window.alert('Failed to add activity: ' + error.message);
    return;
  }

  const newActivity = {
    id: data.id,
    sequence: data.sequence,
    title: data.title,
    time: data.time,
    note: data.note,
    assignment: data.assignment,
    link: data.link,
    attachmentPath: data.attachment_path,
  };

  if (attachmentFile instanceof File && attachmentFile.size > 0) {
    try {
      const uploadedPath = await uploadAttachmentToStorage(data.id, attachmentFile, null)
      const { error: attachmentUpdateError } = await supabase
        .from('activities')
        .update({ attachment_path: uploadedPath })
        .eq('id', data.id)

      if (attachmentUpdateError) throw attachmentUpdateError
      newActivity.attachmentPath = uploadedPath
    } catch (attachmentError) {
      window.alert('Activity created, but attachment upload failed: ' + (attachmentError?.message ?? String(attachmentError)))
    }
  }

  const cachedAssignments = state.data.activityAssignments?.content?.entries;
  if (cachedAssignments) {
    cachedAssignments.push({
      id: newActivity.id,
      dayId: day.id,
      dayLabel: day.label || dayDate,
      title: newActivity.title || '(untitled)',
      assignment: String(newActivity.assignment || '').trim(),
      sequence: newActivity.sequence || 0,
    });
  }

  const insertIndex = Math.max(0, Math.min(targetSequence - 1, existingActivities.length));
  const reordered = [...existingActivities];
  reordered.splice(insertIndex, 0, newActivity);

  try {
    await persistActivityOrder(day, reordered);
    form.reset();
    render();
  } catch (persistError) {
    window.alert('Activity saved, but the order update failed: ' + (persistError?.message ?? String(persistError)));
  }
}

async function handleActivityDelete(event) {
  const button = event.currentTarget
  const activityId = button.dataset.deleteActivityId
  const dayDate = button.dataset.dayDate
  if (!activityId || !dayDate) return

  if (!window.confirm('Delete this activity?')) return

  const day = state.data.schedule?.content?.days?.find((entry) => entry.date === dayDate)
  const activity = day?.activities?.find((entry) => entry.id === activityId)
  if (!day || !activity) return

  const nextActivities = getSortedActivities(day.activities).filter((entry) => entry.id !== activityId)

  const { error } = await supabase
    .from('activities')
    .delete()
    .eq('id', activityId)

  if (error) {
    window.alert('Failed to delete activity: ' + error.message)
    return
  }

  try {
    await persistActivityOrder(day, nextActivities)
    const cachedAssignments = state.data.activityAssignments?.content?.entries
    if (cachedAssignments) {
      state.data.activityAssignments.content.entries = cachedAssignments.filter((entry) => entry.id !== activityId)
    }
    render()
  } catch (persistError) {
    window.alert('Activity deleted, but the order update failed: ' + (persistError?.message ?? String(persistError)))
  }
}

async function handleActivitySelectChange(event) {
  if (!canEdit()) return

  const select = event.currentTarget
  const path = select.dataset.editPath
  if (!path) return

  const nextValue = String(select.value || '').trim()
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

async function uploadAttachmentToStorage(activityId, file, existingPath) {
  const safeName = sanitizeAttachmentFileName(file.name)
  const storagePath = 'activities/' + activityId + '/' + Date.now() + '-' + safeName

  const { error: uploadError } = await supabase.storage
    .from(ACTIVITY_ATTACHMENTS_BUCKET)
    .upload(storagePath, file, { upsert: false })

  if (uploadError) {
    throw uploadError
  }

  if (existingPath) {
    await supabase.storage.from(ACTIVITY_ATTACHMENTS_BUCKET).remove([existingPath])
  }

  return storagePath
}

async function handleAttachmentInputChange(event) {
  if (!canEdit()) return

  const input = event.currentTarget
  const activityId = input.dataset.activityId
  const file = input.files && input.files[0]
  if (!activityId || !file) return

  const context = findActivityContextById(activityId)
  if (!context.activity) return

  const path = 'activities.entries.' + activityId + '.attachment_path'
  setEditStatus(path, 'saving')
  render()

  try {
    const uploadedPath = await uploadAttachmentToStorage(activityId, file, context.activity.attachmentPath || null)
    const saved = await persistEditableValue(path, uploadedPath)
    if (!saved) {
      throw new Error('Could not save uploaded attachment path')
    }

    clearDraftValue(path)
    setEditStatus(path, 'saved')
    render()
    setTimeout(() => {
      if (editStatus[path] === 'saved') {
        setEditStatus(path, null)
        render()
      }
    }, 1200)
  } catch (error) {
    setEditStatus(path, 'error')
    render()
    window.alert('Attachment upload failed: ' + (error?.message ?? String(error)))
  }
}

async function handleAttachmentClearClick(event) {
  if (!canEdit()) return

  const button = event.currentTarget
  const activityId = button.dataset.attachmentClearId
  if (!activityId) return

  const context = findActivityContextById(activityId)
  const existingPath = context.activity?.attachmentPath
  if (!context.activity || !existingPath) return

  const path = 'activities.entries.' + activityId + '.attachment_path'
  setEditStatus(path, 'saving')
  render()

  try {
    await supabase.storage.from(ACTIVITY_ATTACHMENTS_BUCKET).remove([existingPath])
    const saved = await persistEditableValue(path, '')
    if (!saved) {
      throw new Error('Could not clear attachment path')
    }

    clearDraftValue(path)
    setEditStatus(path, 'saved')
    render()
    setTimeout(() => {
      if (editStatus[path] === 'saved') {
        setEditStatus(path, null)
        render()
      }
    }, 1200)
  } catch (error) {
    setEditStatus(path, 'error')
    render()
    window.alert('Failed to remove attachment: ' + (error?.message ?? String(error)))
  }
}

function bindActivityControls() {
  const selects = document.querySelectorAll('.activity-select')
  for (const select of selects) {
    if (select.dataset.bound === 'true') continue
    select.dataset.bound = 'true'
    select.addEventListener('change', handleActivitySelectChange)
  }

  const deleteButtons = document.querySelectorAll('.activity-delete-button')
  for (const button of deleteButtons) {
    if (button.dataset.bound === 'true') continue
    button.dataset.bound = 'true'
    button.addEventListener('click', handleActivityDelete)
  }

  const forms = document.querySelectorAll('.activity-create-form')
  for (const form of forms) {
    if (form.dataset.bound === 'true') continue
    form.dataset.bound = 'true'
    form.addEventListener('submit', handleActivityCreateSubmit)
  }

  const attachmentInputs = document.querySelectorAll('.activity-attachment-input')
  for (const input of attachmentInputs) {
    if (input.dataset.bound === 'true') continue
    input.dataset.bound = 'true'
    input.addEventListener('change', handleAttachmentInputChange)
  }

  const attachmentClearButtons = document.querySelectorAll('.activity-attachment-clear')
  for (const button of attachmentClearButtons) {
    if (button.dataset.bound === 'true') continue
    button.dataset.bound = 'true'
    button.addEventListener('click', handleAttachmentClearClick)
  }
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
  const activityAssignments = state.data.activityAssignments?.content?.entries || []

  // Only show assignments with a non-blank assignee
  const filtered = activityAssignments.filter((entry) => {
    if (!entry.assignment || !entry.assignment.trim()) return false;
    const text = `${entry.dayLabel} ${entry.title} ${entry.assignment}`.toLowerCase();
    return state.searchQuery === '' || text.includes(state.searchQuery);
  });

  // Sort by date (dayLabel), then by sequence, then by title
  filtered.sort((a, b) => {
    // Try to parse dayLabel as a date, fallback to string compare
    const dateA = Date.parse(a.dayLabel);
    const dateB = Date.parse(b.dayLabel);
    if (!isNaN(dateA) && !isNaN(dateB)) {
      if (dateA !== dateB) return dateA - dateB;
    } else {
      const dayCompare = String(a.dayLabel || '').localeCompare(String(b.dayLabel || ''));
      if (dayCompare !== 0) return dayCompare;
    }
    return a.sequence - b.sequence || a.title.localeCompare(b.title);
  });

  el.assignmentsList.innerHTML = '';

  if (filtered.length === 0) {
    el.assignmentsList.innerHTML = '<p style="padding: 1rem; color: var(--muted);">No assignments found.</p>';
    return;
  }

  for (const entry of filtered) {
    const item = document.createElement('div');
    item.className = 'assignment-item';
    item.innerHTML = `
      <div class="assignment-day">${escapeHtml(entry.dayLabel)}</div>
      <div class="assignment-type">${escapeHtml(entry.title)}</div>
      <div class="assignment-person">${renderAssignmentDetails(entry)}</div>
    `;
    el.assignmentsList.appendChild(item);
  }

  bindEditableFields();
}

function renderFood() {
  const food = state.data.food.content
  const foodTitle = getEditableValue('food.title', food.title || 'Food & Meal Planning')
  const foodSummary = getEditableValue('food.summary', food.summary || '')
  const allergiesHeading = getEditableValue('food.allergiesHeading', food.allergiesHeading || 'Allergies & Dietary Notes')
  const kitchenNotesHeading = getEditableValue('food.kitchenNotesHeading', food.kitchenNotesHeading || 'Kitchen Notes')
  const extraRequestsHeading = getEditableValue('food.extraRequestsHeading', food.extraRequestsHeading || 'Extra Requests')
  const allergies = food.allergies || []
  const kitchenNotes = food.kitchenNotes || []
  const extraRequests = food.extraRequests || []

  let html = '<div class="food-view">'

  html += '<h2>' + renderEditableText('food.title', foodTitle, 'Food & Meal Planning', 'inline-food-title') + '</h2>'
  html += '<p>' + renderEditableText('food.summary', foodSummary, 'Add summary', 'inline-food-summary') + '</p>'

  if (food.shoppingDocUrl) {
    html += `<p><a href="${escapeHtml(food.shoppingDocUrl)}" target="_blank" style="color: var(--text); text-decoration: underline; font-weight: 500;">Open Shopping List (Google Doc)</a></p>`
  }

  if (allergies.length > 0) {
    html += '<h3 style="margin-top: 1.5rem;">' + renderEditableText('food.allergiesHeading', allergiesHeading, 'Allergies & Dietary Notes', 'inline-food-heading') + '</h3>'
    html += '<ul style="margin: 0.5rem 0 0 1.5rem;">'
    for (const [index, allergy] of allergies.entries()) {
      const path = 'food.allergies.' + index
      const value = getEditableValue(path, allergy)
      html += '<li>' + renderEditableText(path, value, 'Add allergy note', 'inline-food-item') + '</li>'
    }
    html += '</ul>'
  }

  if (kitchenNotes.length > 0) {
    html += '<h3 style="margin-top: 1.5rem;">' + renderEditableText('food.kitchenNotesHeading', kitchenNotesHeading, 'Kitchen Notes', 'inline-food-heading') + '</h3>'
    html += '<ul style="margin: 0.5rem 0 0 1.5rem;">'
    for (const [index, note] of kitchenNotes.entries()) {
      const path = 'food.kitchenNotes.' + index
      const value = getEditableValue(path, note)
      html += '<li>' + renderEditableText(path, value, 'Add kitchen note', 'inline-food-item') + '</li>'
    }
    html += '</ul>'
  }

  if (extraRequests.length > 0) {
    html += '<h3 style="margin-top: 1.5rem;">' + renderEditableText('food.extraRequestsHeading', extraRequestsHeading, 'Extra Requests', 'inline-food-heading') + '</h3>'
    html += '<ul style="margin: 0.5rem 0 0 1.5rem;">'
    for (const [index, request] of extraRequests.entries()) {
      const path = 'food.extraRequests.' + index
      const value = getEditableValue(path, request)
      html += '<li>' + renderEditableText(path, value, 'Add extra request', 'inline-food-item') + '</li>'
    }
    html += '</ul>'
  }

  html += '</div>'

  el.foodContent.innerHTML = html
  bindEditableFields()
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

async function persistEditableValue(path, value) {
  const normalized = String(value ?? '').trim()

  try {
    const activityMatch = path.match(/^activities\.entries\.([^.]+)\.(title|time|note|link|attachment_path|assignment|sequence)$/)
    if (activityMatch) {
      const activityId = activityMatch[1]
      const field = activityMatch[2]
      const context = findActivityContextById(activityId)
      const day = context.day
      const activity = context.activity

      if (!day || !activity) {
        throw new Error('Activity not found for path: ' + path)
      }

      if (field === 'sequence') {
        const desiredSequence = Math.max(1, Number(normalized || activity.sequence || 1))
        const reordered = getSortedActivities(day.activities).filter((entry) => entry.id !== activityId)
        reordered.splice(Math.min(desiredSequence - 1, reordered.length), 0, activity)
        await persistActivityOrder(day, reordered)
        return true
      }

      const payload = {}
      if (field === 'assignment') {
        payload.assignment = normalized || null
      } else if (field === 'attachment_path') {
        payload.attachment_path = normalized || null
      } else {
        payload[field] = normalized || null
      }

      const { error } = await supabase
        .from('activities')
        .update(payload)
        .eq('id', activity.id)

      if (error) throw error

      if (field === 'assignment') {
        activity.assignment = payload.assignment
        const cachedAssignment = state.data.activityAssignments?.content?.entries?.find((entry) => entry.id === activity.id)
        if (cachedAssignment) {
          cachedAssignment.assignment = payload.assignment || ''
        }
      } else if (field === 'attachment_path') {
        activity.attachmentPath = payload.attachment_path
      } else {
        activity[field] = payload[field]
      }

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

    const foodScalarMatch = path.match(/^food\.(title|summary|allergiesHeading|kitchenNotesHeading|extraRequestsHeading)$/)
    if (foodScalarMatch) {
      const field = foodScalarMatch[1]
      const food = state.data.food?.content
      if (!food) {
        throw new Error('Food metadata missing in state')
      }

      const dbColMap = {
        title: 'title',
        summary: 'summary',
        allergiesHeading: 'allergies_heading',
        kitchenNotesHeading: 'kitchen_notes_heading',
        extraRequestsHeading: 'extra_requests_heading',
      }
      const dbCol = dbColMap[field]
      const nextValue = normalized || food[field]
      const { error } = await supabase
        .from('food_metadata')
        .update({ [dbCol]: nextValue })
        .eq('id', 1)

      if (error) throw error
      food[field] = nextValue
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

function renderAssignmentDetails(entry) {
  const assignmentPath = 'activities.entries.' + entry.id + '.assignment'
  const assignmentValue = getEditableValue(assignmentPath, entry.assignment || '')
  return renderEditableText(assignmentPath, assignmentValue, 'TBD', 'inline-assignee')
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
    if (state.simulatedAuth && !state.session) {
      clearSimulatedAuthState()
      state.userEmail = ''
      render()
      return
    }

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
