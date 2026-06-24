import { describe, it, expect } from 'vitest'
import { kyivInputToUtc, kyivParts, formatKyiv, kyivDateInput, kyivTimeInput } from '../../lib/tz'

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

describe('form prefill helpers', () => {
  it('kyivDateInput / kyivTimeInput produce input-ready strings', () => {
    const d = new Date('2026-06-24T06:00:00.000Z')
    expect(kyivDateInput(d)).toBe('2026-06-24')
    expect(kyivTimeInput(d)).toBe('09:00')
  })
})
