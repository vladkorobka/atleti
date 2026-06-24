import { describe, it, expect } from 'vitest'
import { kyivInputToUtc, kyivParts, formatKyiv, kyivDateInput, kyivTimeInput, kyivSlotParts } from '../../lib/tz'

describe('kyivInputToUtc', () => {
  it('interprets summer wall-clock as Kyiv (UTC+3)', () => {
    // 24 Jun 2026 is EEST (UTC+3): 09:00 Kyiv => 06:00 UTC
    const d = kyivInputToUtc('2026-06-24', '09:00')
    expect(d.toISOString()).toBe('2026-06-24T06:00:00.000Z')
  })

  it('interprets winter wall-clock as Kyiv (UTC+2)', () => {
    // 15 Jan 2026 is EET (UTC+2): 09:00 Kyiv => 07:00 UTC
    const d = kyivInputToUtc('2026-01-15', '09:00')
    expect(d.toISOString()).toBe('2026-01-15T07:00:00.000Z')
  })

  it('round-trips through kyivParts back to the same wall-clock', () => {
    const d = kyivInputToUtc('2026-06-24', '09:00')
    const p = kyivParts(d)
    expect(p).toMatchObject({ year: 2026, month: 6, day: 24, hour: 9, minute: 0 })
  })
})

describe('kyivParts', () => {
  it('returns Kyiv wall-clock parts for a UTC instant', () => {
    const p = kyivParts(new Date('2026-06-24T06:00:00.000Z'))
    expect(p).toMatchObject({ year: 2026, month: 6, day: 24, hour: 9, minute: 0 })
  })
})

describe('formatKyiv', () => {
  it('formats a UTC instant in Kyiv time', () => {
    const out = formatKyiv(new Date('2026-06-24T06:00:00.000Z'), { hour: '2-digit', minute: '2-digit' })
    expect(out).toContain('09:00')
  })
})

describe('kyivSlotParts', () => {
  it('derives Kyiv date, weekday and start minutes from a UTC instant (summer)', () => {
    // 06:00Z = 09:00 Kyiv on Wed 24 Jun 2026
    const parts = kyivSlotParts(new Date('2026-06-24T06:00:00.000Z'))
    expect(parts).toEqual({ date: '2026-06-24', dowKey: 'wed', startMin: 9 * 60 })
  })

  it('uses the Kyiv calendar day at a day boundary', () => {
    // 22:30Z on 23 Jun = 01:30 Kyiv on 24 Jun (next day)
    const parts = kyivSlotParts(new Date('2026-06-23T22:30:00.000Z'))
    expect(parts.date).toBe('2026-06-24')
    expect(parts.startMin).toBe(90)
  })
})

describe('form prefill helpers', () => {
  it('kyivDateInput / kyivTimeInput produce input-ready strings', () => {
    const d = new Date('2026-06-24T06:00:00.000Z')
    expect(kyivDateInput(d)).toBe('2026-06-24')
    expect(kyivTimeInput(d)).toBe('09:00')
  })
})
