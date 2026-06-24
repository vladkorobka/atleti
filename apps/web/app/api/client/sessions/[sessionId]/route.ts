import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { canClientCancel } from '@/lib/session-utils'

type Params = { params: { sessionId: string } }

// Скасування заняття клієнтом = видалення його з розкладу (а не статус "cancelled").
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const existingSession = await Session.findOne({
    _id: params.sessionId,
    clientId: clientSession.userId,
    status: 'scheduled',
  })

  if (!existingSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const coachId = existingSession.coachId.toString()
  const coachProfile = await CoachProfile.findOne({ userId: coachId }, 'cancellationDeadlineHours')
  const deadlineHours = coachProfile?.cancellationDeadlineHours ?? 24

  if (!canClientCancel(existingSession.scheduledAt, deadlineHours)) {
    return NextResponse.json({ error: 'Cancellation deadline passed' }, { status: 403 })
  }

  await Session.deleteOne({ _id: params.sessionId, clientId: clientSession.userId, status: 'scheduled' })

  return NextResponse.json({ ok: true })
}
