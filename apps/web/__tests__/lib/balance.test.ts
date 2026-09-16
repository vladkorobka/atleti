import { describe, it, expect } from 'vitest'
import { sessionsDebt, sessionsAvailable, pluralSessions } from '@/lib/balance'

describe('sessionsDebt', () => {
  it('нуль, поки оплачених вистачає', () => {
    expect(sessionsDebt({ sessionsTotal: 10, sessionsUsed: 4 })).toBe(0)
    expect(sessionsDebt({ sessionsTotal: 4, sessionsUsed: 4 })).toBe(0)
  })

  it('різниця, коли проведених більше за оплачені', () => {
    expect(sessionsDebt({ sessionsTotal: 3, sessionsUsed: 4 })).toBe(1)
    expect(sessionsDebt({ sessionsTotal: 0, sessionsUsed: 2 })).toBe(2)
  })

  it('резерв не впливає — заплановане заняття це ще не борг', () => {
    // 5 оплачених, 5 проведених, скільки б не було запланованих — боргу немає
    expect(sessionsDebt({ sessionsTotal: 5, sessionsUsed: 5 })).toBe(0)
  })
})

describe('sessionsAvailable', () => {
  it('віднімає проведені й заплановані', () => {
    expect(sessionsAvailable({ sessionsTotal: 10, sessionsUsed: 4 }, 2)).toBe(4)
  })

  it('клемпиться в нуль при боргу', () => {
    expect(sessionsAvailable({ sessionsTotal: 3, sessionsUsed: 4 }, 0)).toBe(0)
    expect(sessionsAvailable({ sessionsTotal: 3, sessionsUsed: 4 }, 2)).toBe(0)
  })
})

describe('pluralSessions', () => {
  it('однина', () => {
    expect(pluralSessions(1)).toBe('заняття')
    expect(pluralSessions(21)).toBe('заняття')
    expect(pluralSessions(101)).toBe('заняття')
  })

  it('2-4 — форма родового однини', () => {
    for (const n of [2, 3, 4, 22, 23, 24, 102]) {
      expect(pluralSessions(n)).toBe('заняття')
    }
  })

  it('5-20 та 11-14 — родовий множини', () => {
    for (const n of [0, 5, 9, 10, 11, 12, 13, 14, 20, 25, 111, 112]) {
      expect(pluralSessions(n)).toBe('занять')
    }
  })
})
