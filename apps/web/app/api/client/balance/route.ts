import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function GET() {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    status: 'active',
  })

  if (!relationship) {
    return NextResponse.json({ balance: null, message: 'No active coach' })
  }

  const balance = await Balance.findOne({
    clientId: clientSession.userId,
    coachId: relationship.coachId,
  })

  if (!balance) {
    return NextResponse.json({
      balance: { sessionsTotal: 0, sessionsUsed: 0, sessionsRemaining: 0, transactions: [] },
    })
  }

  return NextResponse.json({
    balance: {
      sessionsTotal: balance.sessionsTotal,
      sessionsUsed: balance.sessionsUsed,
      sessionsRemaining: balance.sessionsTotal - balance.sessionsUsed,
      transactions: balance.transactions,
    },
  })
}
