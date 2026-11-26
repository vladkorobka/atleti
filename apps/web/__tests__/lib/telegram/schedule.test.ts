import { describe, it, expect } from 'vitest'
import { isReminderDue, reminderWindow, kyivDayRange, isDigestHour } from '@/lib/telegram/schedule'
import { kyivWallTimeToUtc } from '@/lib/tz'

describe('reminderWindow', () => {
  // Приклад зі специфікації: заняття завтра о 18:00, дедлайн 24 год → нагадування сьогодні о 17:30.
  const session = kyivWallTimeToUtc(2026, 11, 27, 18, 0)

  it('відкривається за 30 хв до дедлайну скасування', () => {
    expect(reminderWindow(session, 24).from).toEqual(kyivWallTimeToUtc(2026, 11, 26, 17, 30))
    expect(reminderWindow(session, 24).until).toEqual(kyivWallTimeToUtc(2026, 11, 26, 18, 0))
  })
  it('due всередині вікна, не до і не після дедлайну', () => {
    expect(isReminderDue(kyivWallTimeToUtc(2026, 11, 26, 17, 29), session, 24)).toBe(false)
    expect(isReminderDue(kyivWallTimeToUtc(2026, 11, 26, 17, 30), session, 24)).toBe(true)
    expect(isReminderDue(kyivWallTimeToUtc(2026, 11, 26, 17, 55), session, 24)).toBe(true)
    expect(isReminderDue(kyivWallTimeToUtc(2026, 11, 26, 18, 0), session, 24)).toBe(false)
  })
  it('враховує дедлайн конкретного тренера', () => {
    expect(isReminderDue(kyivWallTimeToUtc(2026, 11, 27, 5, 40), session, 12)).toBe(true)
  })
})

describe('kyivDayRange', () => {
  it('межі київської доби', () => {
    const r = kyivDayRange(kyivWallTimeToUtc(2026, 11, 26, 7, 3))
    expect(r.start).toEqual(kyivWallTimeToUtc(2026, 11, 26, 0, 0))
    expect(r.end).toEqual(kyivWallTimeToUtc(2026, 11, 27, 0, 0))
    expect(r.key).toBe('2026-11-26')
  })
  it('доба переходу на літній час має 23 години', () => {
    const r = kyivDayRange(kyivWallTimeToUtc(2026, 3, 29, 12, 0))
    expect(r.end.getTime() - r.start.getTime()).toBe(23 * 3600_000)
  })
  it('isDigestHour — лише 07:xx за Києвом', () => {
    expect(isDigestHour(kyivWallTimeToUtc(2026, 11, 26, 7, 0))).toBe(true)
    expect(isDigestHour(kyivWallTimeToUtc(2026, 11, 26, 7, 59))).toBe(true)
    expect(isDigestHour(kyivWallTimeToUtc(2026, 11, 26, 6, 59))).toBe(false)
    expect(isDigestHour(kyivWallTimeToUtc(2026, 11, 26, 8, 0))).toBe(false)
  })
})
