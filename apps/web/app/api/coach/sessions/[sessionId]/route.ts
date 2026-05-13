import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

type Params = { params: { sessionId: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const { status, cancelReason } = await req.json()
  if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const update: Record<string, unknown> = { status }
  if (status === 'cancelled') {
    update.cancelledBy = coachSession.userId
    update.cancelledByRole = 'coach'
    update.cancelReason = cancelReason ?? ''
  }

  const updatedSession = await Session.findOneAndUpdate(
    { _id: params.sessionId, coachId: coachSession.userId },
    update,
    { new: true }
  )

  if (!updatedSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  return NextResponse.json({ session: updatedSession })
}
