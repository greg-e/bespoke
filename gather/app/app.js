const DATA_FILES = {
  site: '../data/site.json',
  schedule: '../data/schedule.json',
  assignments: '../data/assignments.json',
  food: '../data/food.json',
}

const STORAGE_PREFIX = 'gather-june-2026:'

const state = {
  data: {},
  expandedDays: new Set(),
  usedCacheFallback: false,
  currentView: 'schedule',
  searchQuery: '',
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
      for (const item of day.timeline) {
        const hasTime = item.time && item.time.trim().length > 0
        const liClass = hasTime ? '' : ' class="flexible"'
        
        html += '<li' + liClass + '>'
        html += '<div class="activity-header">'
        html += '<strong>' + escapeHtml(item.title) + '</strong>'
        if (hasTime) {
          html += ' <span class="activity-time">' + escapeHtml(item.time) + '</span>'
        } else if (item.note) {
          html += ' <span class="activity-note">' + escapeHtml(item.note) + '</span>'
        }
        html += '</div>'
        
        // Find related assignments (for timed activities and specific named activities like Lunch)
        const isSpecialActivity = item.title && (item.title.toLowerCase().includes('lunch') || item.title.toLowerCase().includes('hangout'))
        const relatedAssignments = (hasTime || isSpecialActivity) ? findAssignmentsForActivity(item.title, dayAssignments) : []
        
        if (relatedAssignments.length > 0) {
          for (const assignment of relatedAssignments) {
            html += '<div class="assignment-inline">'
            const isLunch = item.title && item.title.toLowerCase().includes('lunch')
            if (isLunch) {
              // For Lunch: show "assignee - type" format
              html += escapeHtml(assignment.assignee) + ' - ' + escapeHtml(assignment.type)
            } else {
              // For all others: just show assignee
              html += escapeHtml(assignment.assignee)
            }
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
      <div class="assignment-person">${escapeHtml(assignment.assignee)}</div>
    `
    el.assignmentsList.appendChild(item)
  }
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

document.addEventListener('DOMContentLoaded', () => {
  const whatsappUrl = 'https://chat.whatsapp.com/GZYt43LWzdd8TcD591s10s?mode=gi_t';
  const headerLink = document.getElementById('whatsapp-link-header');
  const footerLink = document.getElementById('whatsapp-link-footer');
  if (headerLink) headerLink.href = whatsappUrl;
  if (footerLink) footerLink.href = whatsappUrl;
});
