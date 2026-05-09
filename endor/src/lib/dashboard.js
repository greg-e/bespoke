import { listEvents } from './events'
import { listTasks } from './tasks'

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

export function suggestTopTasks(tasks, now = new Date()) {
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
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      if ((left.duration_minutes ?? 999) !== (right.duration_minutes ?? 999)) {
        return (left.duration_minutes ?? 999) - (right.duration_minutes ?? 999)
      }
      return new Date(left.created_at) - new Date(right.created_at)
    })
    .slice(0, 3)
}

export async function loadTodayDashboard() {
  const [tasks, events] = await Promise.all([
    listTasks({ excludeDone: true }),
    listEvents({ from: startOfDay(), to: endOfDay() }),
  ])

  return {
    tasks,
    events,
    suggestedTasks: suggestTopTasks(tasks),
  }
}
