import { describe, it, expect } from 'vitest'
import { checkWithinSchedule, slotParts } from '../../lib/coach-schedule'
import type { ICoachBlock, IWorkingHoursDay } from '@atleti/types'

const hours: IWorkingHoursDay = { start: '09:00', end: '18:00', slotDuration: 60 }
const lunch: ICoachBlock = { _id: '1', coachId: 'c', type: 'time', date: '2026-06-15', startTime: '12:00', endTime: '13:00', label: 'Обід' }

describe('checkWithinSchedule', () => {
  it('у межах графіку, без блоків — ок', () => {
    expect(checkWithinSchedule(hours, [], '2026-06-15', 'mon', 10 * 60, 11 * 60).ok).toBe(true)
  })

  it('не робочий день (немає годин) — помилка', () => {
    expect(checkWithinSchedule(undefined, [], '2026-06-15', 'mon', 10 * 60, 11 * 60).ok).toBe(false)
  })

  it('до початку графіку (02:00) — помилка', () => {
    const r = checkWithinSchedule(hours, [], '2026-06-15', 'mon', 2 * 60, 3 * 60)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('поза межами')
  })

  it('кінець за межами графіку (17:30 + 60 хв) — помилка', () => {
    expect(checkWithinSchedule(hours, [], '2026-06-15', 'mon', 17 * 60 + 30, 18 * 60 + 30).ok).toBe(false)
  })

  it('кінець рівно на межі (17:00 + 60 = 18:00) — ок', () => {
    expect(checkWithinSchedule(hours, [], '2026-06-15', 'mon', 17 * 60, 18 * 60).ok).toBe(true)
  })

  it('поверх обіду (12:30) — помилка з назвою блоку', () => {
    const r = checkWithinSchedule(hours, [lunch], '2026-06-15', 'mon', 12 * 60 + 30, 13 * 60)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Обід')
  })

  it('одразу після обіду (13:00) — ок', () => {
    expect(checkWithinSchedule(hours, [lunch], '2026-06-15', 'mon', 13 * 60, 14 * 60).ok).toBe(true)
  })
})

describe('slotParts (київський пояс)', () => {
  it('розбирає момент у київський настінний час', () => {
    // 07:30Z = 10:30 Kyiv на пн 15 черв 2026
    const { date, dowKey, startMin } = slotParts(new Date('2026-06-15T07:30:00.000Z'))
    expect(date).toBe('2026-06-15')
    expect(dowKey).toBe('mon')
    expect(startMin).toBe(10 * 60 + 30)
  })
})
