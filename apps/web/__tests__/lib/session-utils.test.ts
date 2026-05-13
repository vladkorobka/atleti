import { describe, it, expect } from 'vitest'
import { canClientCancel, getSessionStatusLabel } from '../../lib/session-utils'

describe('canClientCancel', () => {
  it('allows cancel when deadline not reached', () => {
    const scheduledAt = new Date(Date.now() + 25 * 60 * 60 * 1000) // +25 hours
    expect(canClientCancel(scheduledAt, 24)).toBe(true)
  })

  it('blocks cancel when past deadline', () => {
    const scheduledAt = new Date(Date.now() + 23 * 60 * 60 * 1000) // +23 hours
    expect(canClientCancel(scheduledAt, 24)).toBe(false)
  })

  it('blocks cancel for past sessions', () => {
    const scheduledAt = new Date(Date.now() - 60 * 60 * 1000) // -1 hour
    expect(canClientCancel(scheduledAt, 24)).toBe(false)
  })
})

describe('getSessionStatusLabel', () => {
  it('maps statuses to Ukrainian labels', () => {
    expect(getSessionStatusLabel('scheduled')).toBe('Заплановано')
    expect(getSessionStatusLabel('completed')).toBe('Проведено')
    expect(getSessionStatusLabel('cancelled')).toBe('Скасовано')
  })
})
