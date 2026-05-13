import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

type Params = { params: { clientId: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const balance = await Balance.findOne({ clientId: params.clientId, coachId: coachSession.userId })
  if (!balance) {
    return NextResponse.json({ balance: { sessionsTotal: 0, sessionsUsed: 0, sessionsRemaining: 0, transactions: [] } })
  }

  return NextResponse.json({
    balance: {
      sessionsTotal: balance.sessionsTotal,
      sessionsUsed: balance.sessionsUsed,
      sessionsRemaining: balance.sessionsTotal - balance.sessionsUsed,
      transactions: balance.transactions,
    }
  })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const { sessions, note } = await req.json()
  if (!sessions || sessions <= 0) {
    return NextResponse.json({ error: 'Invalid sessions count' }, { status: 400 })
  }

  const transaction = {
    type: 'topup' as const,
    sessions,
    note: note ?? '',
    createdAt: new Date(),
    recordedBy: coachSession.userId,
  }

  const balance = await Balance.findOneAndUpdate(
    { clientId: params.clientId, coachId: coachSession.userId },
    {
      $inc: { sessionsTotal: sessions },
      $push: { transactions: transaction },
    },
    { upsert: true, new: true }
  )

  return NextResponse.json({
    balance: {
      sessionsTotal: balance.sessionsTotal,
      sessionsUsed: balance.sessionsUsed,
      sessionsRemaining: balance.sessionsTotal - balance.sessionsUsed,
      transactions: balance.transactions,
    }
  })
}
