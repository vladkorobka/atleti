import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { sessionUpdateSchema, sessionEditSchema } from '@/lib/validations/coach'

type Params = { params: { sessionId: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const body = await req.json()
  const parsed = sessionUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { status, cancelReason } = parsed.data

  // Тренер може змінити статус будь-якого заняття (навіть минулого) у будь-який бік.
  const before = await Session.findOne({ _id: params.sessionId, coachId: coachSession.userId })
  if (!before) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  const update: Record<string, unknown> = { $set: { status } }
  if (status === 'cancelled') {
    ;(update.$set as Record<string, unknown>).cancelledBy = coachSession.userId
    ;(update.$set as Record<string, unknown>).cancelledByRole = 'coach'
    ;(update.$set as Record<string, unknown>).cancelReason = cancelReason ?? ''
  } else {
    // вихід зі скасованого — прибираємо «привид» причини
    update.$unset = { cancelledBy: '', cancelledByRole: '', cancelReason: '' }
  }

  const updatedSession = await Session.findOneAndUpdate(
    { _id: params.sessionId, coachId: coachSession.userId },
    update,
    { new: true }
  )

  // Баланс рахує лише проведені заняття. Коригуємо за дельтою «рахується як використане».
  const wasUsed = before.status === 'completed'
  const isUsed = status === 'completed'
  if (!wasUsed && isUsed) {
    await Balance.updateOne(
      { clientId: before.clientId, coachId: coachSession.userId },
      { $inc: { sessionsUsed: 1 } }
    )
  } else if (wasUsed && !isUsed) {
    // не даємо піти в мінус
    await Balance.updateOne(
      { clientId: before.clientId, coachId: coachSession.userId, sessionsUsed: { $gte: 1 } },
      { $inc: { sessionsUsed: -1 } }
    )
  }

  return NextResponse.json({ session: updatedSession })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const body = await req.json()
  const parsed = sessionEditSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const updatedSession = await Session.findOneAndUpdate(
    { _id: params.sessionId, coachId: coachSession.userId, status: 'scheduled' },
    { scheduledAt: parsed.data.scheduledAt, duration: parsed.data.duration, type: parsed.data.type },
    { new: true }
  )

  if (!updatedSession) return NextResponse.json({ error: 'Session not found or not editable' }, { status: 404 })
  return NextResponse.json({ session: updatedSession })
}
