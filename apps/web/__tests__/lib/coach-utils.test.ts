import { describe, it, expect } from 'vitest'
import { canInviteClient, getClientLimitMessage } from '../../lib/coach-utils'

describe('canInviteClient', () => {
  it('allows invite when under free plan limit', () => {
    expect(canInviteClient({ activeClients: 5, plan: 'free', clientLimit: 10 })).toBe(true)
  })

  it('blocks invite when at free plan limit', () => {
    expect(canInviteClient({ activeClients: 10, plan: 'free', clientLimit: 10 })).toBe(false)
  })

  it('allows invite on pro plan regardless of count', () => {
    expect(canInviteClient({ activeClients: 50, plan: 'pro', clientLimit: 10 })).toBe(true)
  })
})

describe('getClientLimitMessage', () => {
  it('returns correct usage string', () => {
    expect(getClientLimitMessage(3, 10)).toBe('3 / 10')
  })
})
