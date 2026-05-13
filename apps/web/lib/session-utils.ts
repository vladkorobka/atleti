import type { SessionStatus } from '@atleti/types'

export function canClientCancel(scheduledAt: Date, deadlineHours: number): boolean {
  const now = Date.now()
  const scheduled = scheduledAt.getTime()
  if (scheduled <= now) return false
  return scheduled - now > deadlineHours * 60 * 60 * 1000
}

export function getSessionStatusLabel(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    scheduled: 'Заплановано',
    completed: 'Проведено',
    cancelled: 'Скасовано',
  }
  return labels[status]
}
