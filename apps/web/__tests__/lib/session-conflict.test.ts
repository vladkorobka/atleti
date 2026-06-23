import { describe, it, expect } from 'vitest'
import { intervalsOverlap, hasBlockingConflict } from '../../lib/session-conflict'

describe('intervalsOverlap', () => {
  it('стик впритул — не перетин', () => {
    expect(intervalsOverlap(0, 60, 60, 120)).toBe(false)
    expect(intervalsOverlap(60, 120, 0, 60)).toBe(false)
  })

  it('частковий перетин', () => {
    expect(intervalsOverlap(0, 90, 60, 120)).toBe(true)
  })

  it('вкладений інтервал', () => {
    expect(intervalsOverlap(0, 120, 30, 60)).toBe(true)
  })

  it('повністю окремі', () => {
    expect(intervalsOverlap(0, 60, 120, 180)).toBe(false)
  })
})

const at = (iso: string) => new Date(iso)
const base = '2026-06-16T10:00:00.000Z'

describe('hasBlockingConflict', () => {
  it('немає існуючих — без конфлікту', () => {
    expect(hasBlockingConflict(at(base), 60, 'regular', [])).toBe(false)
  })

  it('regular поверх regular на той самий час — конфлікт', () => {
    const existing = [{ scheduledAt: base, duration: 60, type: 'regular' }]
    expect(hasBlockingConflict(at(base), 60, 'regular', existing)).toBe(true)
  })

  it('split поверх split — дозволено', () => {
    const existing = [{ scheduledAt: base, duration: 60, type: 'split' }]
    expect(hasBlockingConflict(at(base), 60, 'split', existing)).toBe(false)
  })

  it('split поверх regular — конфлікт', () => {
    const existing = [{ scheduledAt: base, duration: 60, type: 'regular' }]
    expect(hasBlockingConflict(at(base), 60, 'split', existing)).toBe(true)
  })

  it('regular поверх split — конфлікт', () => {
    const existing = [{ scheduledAt: base, duration: 60, type: 'split' }]
    expect(hasBlockingConflict(at(base), 60, 'regular', existing)).toBe(true)
  })

  it('split поверх двох split — дозволено', () => {
    const existing = [
      { scheduledAt: base, duration: 60, type: 'split' },
      { scheduledAt: base, duration: 60, type: 'split' },
    ]
    expect(hasBlockingConflict(at(base), 60, 'split', existing)).toBe(false)
  })

  it('split поверх split+regular — конфлікт (не всі Спліт)', () => {
    const existing = [
      { scheduledAt: base, duration: 60, type: 'split' },
      { scheduledAt: base, duration: 60, type: 'regular' },
    ]
    expect(hasBlockingConflict(at(base), 60, 'split', existing)).toBe(true)
  })

  it('стик впритул — не конфлікт (10:00+60 і 11:00)', () => {
    const existing = [{ scheduledAt: '2026-06-16T11:00:00.000Z', duration: 60, type: 'regular' }]
    expect(hasBlockingConflict(at(base), 60, 'regular', existing)).toBe(false)
  })

  it('довге заняття частково перекриває (10:00+90 і 11:00) — конфлікт', () => {
    const existing = [{ scheduledAt: '2026-06-16T11:00:00.000Z', duration: 60, type: 'regular' }]
    expect(hasBlockingConflict(at(base), 90, 'regular', existing)).toBe(true)
  })
})
