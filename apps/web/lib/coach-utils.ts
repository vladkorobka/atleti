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

export function getClientLimitMessage({ activeClients, plan, clientLimit }: ClientLimitCheck): string {
  if (plan === 'pro') return `${activeClients}`
  return `${activeClients} / ${clientLimit}`
}
