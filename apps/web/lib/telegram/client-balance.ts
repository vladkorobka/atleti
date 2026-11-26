import { ClientCoach, Balance, Session } from '@atleti/db'
import { sessionsAvailable, sessionsDebt } from '@/lib/balance'

export interface ClientBalance {
  coachId: string
  available: number
  // Без обрізання в нуль: від'ємне — заплановано понад оплачене (запис у борг).
  remainder: number
  debt: number
  upcoming: { _id: unknown; scheduledAt: Date; type: string; duration: number }[]
}

// Ті самі формули, що й /api/client/balance: резерв — усі заплановані заняття
// цього тренера, а не лише майбутні, бо минулі ще не проведені крізь settle.
export async function getClientBalance(clientId: unknown, coachId?: unknown): Promise<ClientBalance | null> {
  if (!coachId) {
    const rel = await ClientCoach.findOne({ clientId, status: 'active' }).lean()
    if (!rel) return null
    coachId = rel.coachId
  }
  const [balance, reserved, upcoming] = await Promise.all([
    Balance.findOne({ clientId, coachId }).lean(),
    Session.countDocuments({ clientId, coachId, status: 'scheduled' }),
    Session.find({ clientId, coachId, status: 'scheduled', scheduledAt: { $gt: new Date() } })
      .sort({ scheduledAt: 1 }).select({ scheduledAt: 1, type: 1, duration: 1 }).lean(),
  ])
  const counts = balance ?? { sessionsTotal: 0, sessionsUsed: 0 }
  return {
    coachId: String(coachId),
    available: sessionsAvailable(counts, reserved),
    remainder: counts.sessionsTotal - counts.sessionsUsed - reserved,
    debt: sessionsDebt(counts),
    upcoming,
  }
}
