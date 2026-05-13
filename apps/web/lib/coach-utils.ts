import type { CoachPlan } from '@atleti/types'

interface ClientLimitCheck {
  activeClients: number
  plan: CoachPlan
  clientLimit: number
}

export function canInviteClient({ activeClients, plan, clientLimit }: ClientLimitCheck): boolean {
  if (plan === 'pro') return true
  return activeClients < clientLimit
}

export function getClientLimitMessage(active: number, limit: number): string {
  return `${active} / ${limit}`
}
