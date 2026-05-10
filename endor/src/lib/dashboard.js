import { listEvents } from './events'
import { listTasks } from './tasks'

function parseDateValue(value) {
  const parsed = new Date(value)
  const time = parsed.getTime()
  return Number.isNaN(time) ? null : parsed
}

function toCreatedAtTime(task) {
  const parsed = parseDateValue(task.created_at)
  return parsed ? parsed.getTime() : Number.POSITIVE_INFINITY
}

export function compareTasksDeterministically(left, right) {
  if (right.score !== left.score) return right.score - left.score

  if ((left.duration_minutes ?? 999) !== (right.duration_minutes ?? 999)) {
    return (left.duration_minutes ?? 999) - (right.duration_minutes ?? 999)
  }

  const createdAtDiff = toCreatedAtTime(left) - toCreatedAtTime(right)
  if (createdAtDiff !== 0) return createdAtDiff

  return String(left.id ?? '').localeCompare(String(right.id ?? ''))
}

export function startOfDay(date = new Date()) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

export function endOfDay(date = new Date()) {
  const value = new Date(date)
  value.setHours(23, 59, 59, 999)
  return value
}

export function isSameDay(left, right) {
  return left.toDateString() === right.toDateString()
}

export function isWithinThisWeek(date, now = new Date()) {
  const current = new Date(now)
  const start = startOfDay(current)
  start.setDate(start.getDate() - start.getDay())
  const end = endOfDay(start)
  end.setDate(end.getDate() + 6)

  return date >= start && date <= end
}

export function suggestTopTasks(tasks, options = {}) {
  const now = options.now ?? new Date()
  const limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : 3
  const today = startOfDay(now)

  return tasks
    .filter((task) => task.status !== 'done')
    .map((task) => {
      const reasons = []
      let score = 0

      if (task.is_pinned) {
        score += 100
        reasons.push('Pinned for today')
      }

      if (task.due_date) {
        const due = new Date(`${task.due_date}T00:00:00`)

        if (due < today) {
          score += 80
          reasons.push('Overdue')
        } else if (isSameDay(due, today)) {
          score += 60
          reasons.push('Due today')
        } else if (isWithinThisWeek(due, now)) {
          score += 40
          reasons.push('Due this week')
        }
      }

      if (task.recurrence_rule && !task.recurrence_paused) {
        score += 20
        reasons.push('Recurring')
      }

      const duration = task.duration_minutes ?? 999
      const durationScore = Math.max(0, 240 - duration)

      return {
        ...task,
        score: score + Math.floor(durationScore / 10),
        reasons,
      }
    })
    .sort(compareTasksDeterministically)
    .slice(0, limit)
}

export async function loadTodayDashboard(options = {}) {
  const now = options.now ?? new Date()
  const suggestionLimit = Number.isFinite(options.suggestionLimit)
    ? Math.max(1, options.suggestionLimit)
    : 8

  const [tasks, events] = await Promise.all([
    listTasks({ excludeDone: true }),
    listEvents({ from: startOfDay(now), to: endOfDay(now) }),
  ])

  return {
    tasks,
    events,
    suggestedTasks: suggestTopTasks(tasks, { limit: suggestionLimit, now }),
  }
}
