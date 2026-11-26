import { kyivParts, kyivWallTimeToUtc } from '@/lib/tz'

export const REMINDER_LEAD_MIN = 30
export const DIGEST_HOUR = 7

// Нагадування приходить за 30 хв до дедлайну скасування і має сенс лише поки
// дедлайн не минув: після нього клієнт уже нічого не скасує.
export function reminderWindow(scheduledAt: Date, deadlineHours: number): { from: Date; until: Date } {
  const until = new Date(scheduledAt.getTime() - deadlineHours * 3600_000)
  const from = new Date(until.getTime() - REMINDER_LEAD_MIN * 60_000)
  return { from, until }
}

export function isReminderDue(now: Date, scheduledAt: Date, deadlineHours: number): boolean {
  const { from, until } = reminderWindow(scheduledAt, deadlineHours)
  return now >= from && now < until
}

// Межі київської доби, у яку потрапляє `now`, в UTC.
export function kyivDayRange(now: Date): { start: Date; end: Date; key: string } {
  const p = kyivParts(now)
  const start = kyivWallTimeToUtc(p.year, p.month, p.day, 0, 0)
  // +1 календарний день через Date.UTC, а не +24 год: доба переходу DST має 23/25 год
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1))
  const end = kyivWallTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0)
  const key = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
  return { start, end, key }
}

// Дайджест іде лише протягом години 07:xx: якщо cron лежав і ожив об 11:00,
// ранковий розклад уже ні до чого.
export function isDigestHour(now: Date): boolean {
  return kyivParts(now).hour === DIGEST_HOUR
}
