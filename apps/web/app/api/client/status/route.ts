import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, CoachProfile, Balance } from '@atleti/db'
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
    status: { $in: ['pending', 'active', 'terminated'] },
  })
    .sort({ invitedAt: -1 })
    .populate('coachId', 'name nickname')

  if (!relationship) {
    return NextResponse.json({ status: 'none', coach: null, balance: null })
  }

  const coachUser = relationship.coachId as any
  let coachProfile = null
  let balance = null

  if (relationship.status === 'active') {
    ;[coachProfile, balance] = await Promise.all([
      CoachProfile.findOne({ userId: coachUser._id }, 'bio specializations cancellationDeadlineHours'),
      Balance.findOne({ clientId: clientSession.userId, coachId: coachUser._id }),
    ])
  }

  const sessionsRemaining = balance
    ? balance.sessionsTotal - balance.sessionsUsed
    : 0

  return NextResponse.json({
    status: relationship.status,
    coach: {
      id: coachUser._id.toString(),
      name: coachUser.name,
      nickname: coachUser.nickname,
      bio: coachProfile?.bio ?? null,
      specializations: coachProfile?.specializations ?? [],
      cancellationDeadlineHours: coachProfile?.cancellationDeadlineHours ?? 24,
    },
    balance: balance ? {
      sessionsTotal: balance.sessionsTotal,
      sessionsUsed: balance.sessionsUsed,
      sessionsRemaining,
      transactions: balance.transactions,
    } : null,
    invitedAt: relationship.invitedAt,
    acceptedAt: relationship.acceptedAt ?? null,
  })
}
