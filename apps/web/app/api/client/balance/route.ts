import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { settlePastSessions } from '@/lib/settle-sessions'

export async function GET() {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  // спершу закриваємо минулі заплановані заняття (scheduled → completed), щоб лічильники були свіжі
  await settlePastSessions({ clientId: clientSession.userId })

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    status: 'active',
  })

  if (!relationship) {
    return NextResponse.json({ balance: null, message: 'No active coach' })
  }

  const [balance, reserved] = await Promise.all([
    Balance.findOne({ clientId: clientSession.userId, coachId: relationship.coachId }),
    Session.countDocuments({
      clientId: clientSession.userId,
      coachId: relationship.coachId,
      status: 'scheduled',
    }),
  ])

  if (!balance) {
    return NextResponse.json({
      balance: {
        sessionsTotal: 0, sessionsUsed: 0, sessionsReserved: reserved,
        sessionsAvailable: 0, sessionsRemaining: 0, transactions: [],
      },
    })
  }

  // Доступно для бронювання = всього - проведено - заплановано (резерв).
  const available = Math.max(0, balance.sessionsTotal - balance.sessionsUsed - reserved)
  return NextResponse.json({
    balance: {
      sessionsTotal: balance.sessionsTotal,
      sessionsUsed: balance.sessionsUsed,
      sessionsReserved: reserved,
      sessionsAvailable: available,
      // sessionsRemaining лишаємо для зворотної сумісності (всього - проведено)
      sessionsRemaining: balance.sessionsTotal - balance.sessionsUsed,
      transactions: balance.transactions,
    },
  })
}
