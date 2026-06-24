import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, Balance, Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function PATCH() {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    status: 'pending',
  })

  if (!relationship) {
    return NextResponse.json({ error: 'No pending invitation' }, { status: 404 })
  }

  await ClientCoach.updateOne(
    { _id: relationship._id },
    { status: 'active', acceptedAt: new Date() }
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    status: { $in: ['active', 'pending'] },
  })

  if (!relationship) {
    return NextResponse.json({ error: 'No active coach relationship' }, { status: 404 })
  }

  // Terminate + reset balance + прибрати заплановані/скасовані заняття з обох розкладів.
  // Проведені (completed) лишаємо як історію.
  await Promise.all([
    ClientCoach.updateOne(
      { _id: relationship._id },
      { status: 'terminated' }
    ),
    Balance.updateOne(
      { clientId: clientSession.userId, coachId: relationship.coachId },
      { sessionsTotal: 0, sessionsUsed: 0, transactions: [] }
    ),
    Session.deleteMany({
      clientId: clientSession.userId,
      coachId: relationship.coachId,
      status: { $in: ['scheduled', 'cancelled'] },
    }),
  ])

  return NextResponse.json({ ok: true })
}
