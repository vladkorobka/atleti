import { describe, it, expect } from 'vitest'
import { generateSlots, isDayBlocked, getBlockedSlots, getSlotBlock } from '../../lib/slot-utils'
import type { ICoachBlock } from '@atleti/types'

describe('generateSlots', () => {
  it('generates hourly slots from 09:00 to 12:00', () => {
    expect(generateSlots('09:00', '12:00', 60)).toEqual(['09:00', '10:00', '11:00'])
  })

  it('generates 30-min slots', () => {
    expect(generateSlots('09:00', '10:00', 30)).toEqual(['09:00', '09:30'])
  })
})

const slots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00']

describe('isDayBlocked', () => {
  it('returns true for a one-time day block matching date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', date: '2026-05-14' }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(true)
  })

  it('returns false when date does not match', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', date: '2026-05-15' }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(false)
  })

  it('returns true for vacation covering the date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'vacation', dateFrom: '2026-07-01', dateTo: '2026-07-14' }]
    expect(isDayBlocked(blocks, '2026-07-07', 'tue')).toBe(true)
  })

  it('returns false for vacation not covering the date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'vacation', dateFrom: '2026-07-01', dateTo: '2026-07-14' }]
    expect(isDayBlocked(blocks, '2026-06-30', 'tue')).toBe(false)
  })

  it('returns true for recurring weekly day block on matching dow', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', recurring: { type: 'weekly', dayOfWeek: 'thu' } }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(true)
  })

  it('returns false for recurring weekly block on non-matching dow', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', recurring: { type: 'weekly', dayOfWeek: 'thu' } }]
    expect(isDayBlocked(blocks, '2026-05-15', 'fri')).toBe(false)
  })

  it('respects until — expired recurring block is ignored', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'day', recurring: { type: 'daily', until: '2026-05-13' } }]
    expect(isDayBlocked(blocks, '2026-05-14', 'thu')).toBe(false)
  })
})

describe('getBlockedSlots', () => {
  it('blocks slots within a one-time time block range', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '14:00' }]
    expect(getBlockedSlots(blocks, '2026-05-14', 'thu', slots, 60)).toEqual(['12:00', '13:00'])
  })

  it('does not block slots outside time block range', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00' }]
    const result = getBlockedSlots(blocks, '2026-05-14', 'thu', slots, 60)
    expect(result).toEqual(['12:00'])
    expect(result).not.toContain('13:00')
  })

  it('handles recurring daily time block', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', startTime: '12:00', endTime: '13:00', recurring: { type: 'daily' } }]
    expect(getBlockedSlots(blocks, '2026-05-14', 'thu', slots, 60)).toEqual(['12:00'])
  })

  it('returns empty when no blocks apply to date', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', date: '2026-05-15', startTime: '12:00', endTime: '13:00' }]
    expect(getBlockedSlots(blocks, '2026-05-14', 'thu', slots, 60)).toEqual([])
  })

  it('detects partial overlap: 60-min slot at 12:00 overlaps block 12:30–13:00', () => {
    const blocks: ICoachBlock[] = [{ _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:30', endTime: '13:00' }]
    const result = getBlockedSlots(blocks, '2026-05-14', 'thu', ['12:00'], 60)
    expect(result).toContain('12:00')
  })
})

describe('getSlotBlock', () => {
  it('returns the block that covers the given slot', () => {
    const lunch: ICoachBlock = { _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00', label: 'Обід' }
    expect(getSlotBlock([lunch], '12:00', '2026-05-14', 'thu', 60)).toBe(lunch)
  })

  it('returns null when slot is not blocked', () => {
    const lunch: ICoachBlock = { _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00' }
    expect(getSlotBlock([lunch], '11:00', '2026-05-14', 'thu', 60)).toBeNull()
  })

  it('detects partial overlap: 60-min slot at 12:00 overlaps block 12:30–13:30', () => {
    const block: ICoachBlock = { _id: '1', coachId: 'c', type: 'time', date: '2026-05-14', startTime: '12:30', endTime: '13:30' }
    expect(getSlotBlock([block], '12:00', '2026-05-14', 'thu', 60)).toBe(block)
  })
})
