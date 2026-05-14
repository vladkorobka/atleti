import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, ClientCoach, CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { canClientCancel } from '@/lib/session-utils'
import { clientCancelSchema } from '@/lib/validations/client'

type Params = { params: { sessionId: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const body = await req.json()
  const parsed = clientCancelSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { cancelReason } = parsed.data

  const existingSession = await Session.findOne({
    _id: params.sessionId,
    clientId: clientSession.userId,
    status: 'scheduled',
  })

  if (!existingSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    coachId: existingSession.coachId,
    status: 'active',
  })

  const coachId = existingSession.coachId.toString()

  const coachProfile = await CoachProfile.findOne({ userId: coachId }, 'cancellationDeadlineHours')
  const deadlineHours = coachProfile?.cancellationDeadlineHours ?? 24

  if (!canClientCancel(existingSession.scheduledAt, deadlineHours)) {
    return NextResponse.json({ error: 'Cancellation deadline passed' }, { status: 403 })
  }

  const updatedSession = await Session.findOneAndUpdate(
    { _id: params.sessionId, clientId: clientSession.userId, status: 'scheduled' },
    {
      status: 'cancelled',
      cancelledBy: clientSession.userId,
      cancelledByRole: 'client',
      cancelReason: cancelReason ?? '',
    },
    { new: true }
  )

  if (!updatedSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({ session: updatedSession })
}
