const DATA_FILES = {
  site: '../data/site.json',
  schedule: '../data/schedule.json',
  food: '../data/food.json',
  assignments: '../data/assignments.json',
  changelog: '../data/changelog.json',
  roster: '../data/roster.json',
}

const STORAGE_PREFIX = 'gather-june-2026:'
const INTRO_SEEN_KEY = STORAGE_PREFIX + 'intro-seen'
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
})

const state = {
  data: {},
  selectedTab: 'home',
  selectedDay: null,
  usedCacheFallback: false,
  showIntro: true,
}

const el = {
  title: document.getElementById('app-title'),
  subtitle: document.getElementById('app-subtitle'),
  introScreen: document.getElementById('intro-screen'),
  introLocationName: document.getElementById('intro-location-name'),
  introLocationLine1: document.getElementById('intro-location-line1'),
  introLocationLine2: document.getElementById('intro-location-line2'),
  introMapLink: document.getElementById('intro-map-link'),
  enterApp: document.getElementById('enter-app'),
  topNav: document.getElementById('top-nav'),
  statusStrip: document.getElementById('status-strip'),
  skeleton: document.getElementById('skeleton'),
  content: document.getElementById('content'),
  tabs: [...document.querySelectorAll('.tab')],
  panels: {
    home: document.getElementById('panel-home'),
    location: document.getElementById('panel-location'),
    food: document.getElementById('panel-food'),
    schedule: document.getElementById('panel-schedule'),
    assignments: document.getElementById('panel-assignments'),
  },
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

  state.selectedDay = pickInitialDay(state.data.site.content.dateRange)
  state.showIntro = !sessionStorage.getItem(INTRO_SEEN_KEY)

  activateTabs()
  el.skeleton.classList.add('hidden')

  if (state.showIntro) {
    renderIntro()
  } else {
    showMainView()
  }
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

function activateTabs() {
  for (const tab of el.tabs) {
    tab.addEventListener('click', () => {
      state.selectedTab = tab.dataset.tab
      render()
    })
  }

  el.enterApp.addEventListener('click', () => {
    sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    state.showIntro = false
    showMainView()
  })
}

function renderIntro() {
  const site = state.data.site.content
  el.title.textContent = site.title
  el.subtitle.textContent = site.subtitle
  el.introLocationName.textContent = site.location.name
  el.introLocationLine1.textContent = site.location.addressLine1
  el.introLocationLine2.textContent = site.location.addressLine2
  el.introMapLink.href = site.location.mapOpenUrl

  el.introScreen.classList.remove('hidden')
  el.topNav.classList.add('hidden')
  el.statusStrip.classList.add('hidden')
  el.content.classList.add('hidden')
}

function showMainView() {
  el.introScreen.classList.add('hidden')
  el.topNav.classList.remove('hidden')
  el.statusStrip.classList.remove('hidden')
  el.content.classList.remove('hidden')
  render()
}

function pickInitialDay(range) {
  const today = new Date()
  const now = toDateOnly(today)
  const start = toDateOnly(parseIsoLocal(range.start))
  const end = toDateOnly(parseIsoLocal(range.end))

  if (now < start) {
    return isoDate(start)
  }

  if (now > end) {
    return isoDate(end)
  }

  return isoDate(now)
}

function render() {
  renderStatusStrip()
  renderPanels()
  syncTabButtons()
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

  const selectedDayLabel = formatDate(state.selectedDay)
  parts.push('<span class="badge">Viewing: ' + escapeHtml(selectedDayLabel) + '</span>')

  el.statusStrip.innerHTML = parts.join('')
}

function renderPanels() {
  const site = state.data.site.content
  const schedule = state.data.schedule.content
  const food = state.data.food.content
  const assignments = state.data.assignments.content
  const changelog = state.data.changelog.content

  el.title.textContent = site.title
  el.subtitle.textContent = site.subtitle

  el.panels.home.innerHTML = renderHome(site, schedule, assignments, changelog)
  el.panels.location.innerHTML = renderLocation(site)
  el.panels.food.innerHTML = renderFood(food)
  el.panels.schedule.innerHTML = renderSchedule(schedule)
  el.panels.assignments.innerHTML = renderAssignments(assignments)

  for (const [name, panel] of Object.entries(el.panels)) {
    panel.classList.toggle('hidden', name !== state.selectedTab)
  }

  bindDayChipActions()
}

function syncTabButtons() {
  for (const tab of el.tabs) {
    tab.classList.toggle('is-active', tab.dataset.tab === state.selectedTab)
  }
}

function renderHome(site, schedule, assignments, changelog) {
  const dateContext = getDateContext(site.dateRange)
  const todayLabel = formatDate(new Date())
  const dayTimeline = schedule.days.find((d) => d.date === state.selectedDay)?.timeline ?? []
  const dayAssignments = assignments.entries.filter((entry) => entry.day === state.selectedDay)

  return (
    '<section class="card">' +
    '<h2>Today: ' + escapeHtml(todayLabel) + '</h2>' +
    renderCountdown(dateContext, site) +
    '<div class="day-focus">' +
    '<h2>' +
    escapeHtml(formatDate(state.selectedDay)) +
    '</h2>' +
    '<p class="muted">Day-first view</p>' +
    '</div>' +
    '<div class="day-chips">' + renderDayChips(schedule.days) + '</div>' +
    '<h3 style="margin-top:1rem;">Timeline</h3>' +
    renderTimeline(dayTimeline) +
    '<h3 style="margin-top:1rem;">Assignments</h3>' +
    renderAssignmentList(dayAssignments, true) +
    '</section>'
  )
}

function renderFood(food) {
  return (
    '<section class="grid-2">' +
    '<div class="card">' +
    '<h2>Food Plan</h2>' +
    '<p>' + escapeHtml(food.summary) + '</p>' +
    '<p><a class="btn" href="' + escapeHtml(food.shoppingDocUrl) + '" target="_blank" rel="noreferrer">Open Shopping List</a></p>' +
    '<h3>Breakfast Assignments</h3>' +
    renderList(food.brunchVolunteers.map((item) => item.day + ': ' + item.assignees.join(', '))) +
    '<h3>Salad Assignments</h3>' +
    renderList(food.saladAssignments.map((item) => item.day + ': ' + item.assignee)) +
    '<h3>Supper Assignments</h3>' +
    renderList(food.supperAssignments.map((item) => item.day + ': ' + item.assignee)) +
    '</div>' +
    '<div class="card">' +
    '<h2>Allergy And Food Constraints</h2>' +
    renderList(food.allergies) +
    '<h3>Kitchen Notes</h3>' +
    renderList(food.kitchenNotes) +
    '<h3>Snacks And Extras</h3>' +
    renderList(food.extraRequests) +
    '</div>' +
    '</section>'
  )
}

function renderLocation(site) {
  const mapContent = navigator.onLine
    ? '<div class="map-wrap"><iframe title="Map preview" loading="lazy" src="' +
      escapeHtml(site.location.mapEmbedUrl) +
      '"></iframe></div>'
    : '<p class="muted">Map is hidden while offline. Reconnect to load location preview.</p>'

  return (
    '<section class="card">' +
    '<h2>Location</h2>' +
    '<p><strong>' +
    escapeHtml(site.location.name) +
    '</strong><br />' +
    escapeHtml(site.location.addressLine1) +
    '<br />' +
    escapeHtml(site.location.addressLine2) +
    '</p>' +
    '<p><a class="btn" href="' +
    escapeHtml(site.location.mapOpenUrl) +
    '" target="_blank" rel="noreferrer">Open in OpenStreetMap</a></p>' +
    mapContent +
    '</section>'
  )
}

function renderSchedule(schedule) {
  const day = schedule.days.find((d) => d.date === state.selectedDay)

  return (
    '<section class="card">' +
    '<h2>Daily Schedule</h2>' +
    '<div class="day-chips">' + renderDayChips(schedule.days) + '</div>' +
    '<h3 style="margin-top: 1rem;">' + escapeHtml(day?.label ?? 'Day') + '</h3>' +
    renderTimeline(day?.timeline ?? []) +
    '<h3 style="margin-top: 1rem;">Hangout Ideas</h3>' +
    renderList(schedule.hangoutIdeas) +
    '</section>'
  )
}

function renderAssignments(assignments) {
  const dayEntries = assignments.entries.filter((entry) => entry.day === state.selectedDay)

  return (
    '<section class="card">' +
    '<h2>Assignments</h2>' +
    '<p class="muted">Types: breakfast prep, meal prep, salad, cleanup crew, activity lead. Missing details are marked as TBD.</p>' +
    '<div class="day-chips">' + renderDayChips(assignments.days) + '</div>' +
    '<div style="margin-top:1rem;">' + renderAssignmentList(dayEntries, false) + '</div>' +
    '</section>'
  )
}

function renderCountdown(dateContext, site) {
  if (!dateContext.isBeforeStart) {
    return ''
  }

  const daysLeft = dateContext.daysUntilStart

  return (
    '<div class="card" style="padding:0.75rem; margin: 0 0 0.9rem 0;">' +
    '<strong>Countdown:</strong> ' +
    daysLeft +
    ' day' +
    (daysLeft === 1 ? '' : 's') +
    ' until ' +
    escapeHtml(formatDate(site.dateRange.start)) +
    '. Use the day links below to preview each day.' +
    '</div>'
  )
}

function renderTimeline(items) {
  if (!items.length) {
    return '<p class="muted">No timeline items yet.</p>'
  }

  return (
    '<ul class="timeline">' +
    items
      .map((item) => {
        const note = item.note ? '<div class="muted">' + escapeHtml(item.note) + '</div>' : ''
        return (
          '<li>' +
          '<div class="timeline-time">' +
          escapeHtml(item.time || 'TBD') +
          '</div>' +
          '<div>' +
          escapeHtml(item.title || 'TBD') +
          maybeTbd(item.title) +
          '</div>' +
          note +
          '</li>'
        )
      })
      .join('') +
    '</ul>'
  )
}

function renderAssignmentList(entries, compact) {
  if (!entries.length) {
    return '<p class="muted">No assignments for this day yet.</p>'
  }

  return (
    '<ul class="assignment-list">' +
    entries
      .map((entry) => {
        const type = entry.type || 'TBD'
        const assignee = entry.assignee || 'TBD'
        const note = entry.note || 'TBD'

        return (
          '<li>' +
          '<div><strong>' +
          escapeHtml(type) +
          '</strong>' +
          maybeTbd(entry.type) +
          '</div>' +
          '<div>Assigned: ' + escapeHtml(assignee) + maybeTbd(entry.assignee) + '</div>' +
          (compact
            ? ''
            : '<div class="muted">Notes: ' + escapeHtml(note) + maybeTbd(entry.note) + '</div>') +
          '</li>'
        )
      })
      .join('') +
    '</ul>'
  )
}

function renderList(items) {
  if (!items?.length) {
    return '<p class="muted">Nothing listed yet.</p>'
  }

  return '<ul class="list">' + items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('') + '</ul>'
}

function renderChangelog(entries) {
  if (!entries?.length) {
    return '<p class="muted">No updates logged yet.</p>'
  }

  return (
    '<ul class="changelog-list">' +
    entries
      .slice(0, 8)
      .map((entry) => {
        return (
          '<li><strong>' +
          escapeHtml(entry.date) +
          '</strong> - ' +
          escapeHtml(entry.title || 'Update') +
          '<div class="muted">' +
          escapeHtml(entry.details || 'TBD') +
          '</div></li>'
        )
      })
      .join('') +
    '</ul>'
  )
}

function renderDayChips(days) {
  return days
    .map((day) => {
      const active = day.date === state.selectedDay ? ' is-active' : ''
      return (
        '<button class="chip' +
        active +
        '" data-day="' +
        escapeHtml(day.date) +
        '" type="button">' +
        escapeHtml(day.shortLabel || day.label || day.date) +
        '</button>'
      )
    })
    .join('')
}

function bindDayChipActions() {
  document.querySelectorAll('[data-day]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDay = button.dataset.day
      render()
    })
  })

  document.querySelectorAll('.tab-jump').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedTab = button.dataset.jump
      render()
    })
  })
}

function getDateContext(range) {
  const today = toDateOnly(new Date())
  const start = toDateOnly(parseIsoLocal(range.start))

  if (today >= start) {
    return { isBeforeStart: false, daysUntilStart: 0 }
  }

  const daysUntilStart = Math.ceil((start.getTime() - today.getTime()) / 86400000)
  return { isBeforeStart: true, daysUntilStart }
}

function formatDate(dateLike) {
  const date = typeof dateLike === 'string' ? new Date(dateLike + 'T00:00:00') : new Date(dateLike)
  return DATE_FORMATTER.format(date)
}

function parseIsoLocal(isoDateValue) {
  const [year, month, day] = isoDateValue.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function maybeTbd(value) {
  return value ? '' : '<span class="tbd">TBD</span>'
}

function toDateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
