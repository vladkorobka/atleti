import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, ClientCoach, CoachProfile, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { settlePastSessions } from '@/lib/settle-sessions'
import { bookingSchema } from '@/lib/validations/client'
import { generateSlots } from '@/lib/slot-utils'
import { slotParts } from '@/lib/coach-schedule'

export async function GET(req: NextRequest) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  await settlePastSessions({ clientId: clientSession.userId })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')

  const query: Record<string, unknown> = { clientId: clientSession.userId }
  if (status) {
    query.status = status
  }

  const sessions = await Session.find(query)
    .populate('coachId', 'name nickname')
    .sort({ scheduledAt: -1 })

  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { scheduledAt: scheduledAtStr, type } = parsed.data

  const scheduledAt = new Date(scheduledAtStr)
  if (scheduledAt <= new Date()) {
    return NextResponse.json({ error: 'Cannot book a past slot' }, { status: 400 })
  }

  await ensureDB()

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    status: 'active',
  })
  if (!relationship) {
    return NextResponse.json({ error: 'No active coach' }, { status: 404 })
  }
  const coachId = relationship.coachId

  // Слот має співпадати з робочим графіком тренера — усе в київському поясі.
  const { dowKey, startMin } = slotParts(scheduledAt)
  const dayHours = (await CoachProfile.findOne({ userId: coachId }, 'workingHours'))?.workingHours?.[dowKey]
  if (!dayHours?.start || !dayHours?.end || !dayHours?.slotDuration) {
    return NextResponse.json({ error: 'Slot not within working hours' }, { status: 400 })
  }
  const slotTime = `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`
  if (!generateSlots(dayHours.start, dayHours.end, dayHours.slotDuration).includes(slotTime)) {
    return NextResponse.json({ error: 'Slot not within working hours' }, { status: 400 })
  }

  // Баланс списується при завершенні заняття (settle), а не при бронюванні.
  // Заплановані заняття рахуються як резерв проти пакета, щоб не перебронювати:
  // completed (used) + scheduled (reserved) не може перевищити sessionsTotal.
  const balance = await Balance.findOne({ clientId: clientSession.userId, coachId })
  const total = balance?.sessionsTotal ?? 0
  const used = balance?.sessionsUsed ?? 0
  const reserved = await Session.countDocuments({
    clientId: clientSession.userId,
    coachId,
    status: 'scheduled',
  })
  if (used + reserved >= total) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 402 })
  }

  const conflict = await Session.findOne({ coachId, scheduledAt, status: 'scheduled' })
  if (conflict) {
    return NextResponse.json({ error: 'Slot already booked' }, { status: 409 })
  }

  const newSession = await Session.create({
    clientId: clientSession.userId,
    coachId,
    scheduledAt,
    duration: dayHours.slotDuration,
    type,
    status: 'scheduled',
    createdBy: 'client',
  })

  return NextResponse.json({ session: newSession }, { status: 201 })
}
