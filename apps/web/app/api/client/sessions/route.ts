import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, ClientCoach, CoachProfile, Balance } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { bookingSchema } from '@/lib/validations/client'
import { generateSlots } from '@/lib/slot-utils'

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type DowKey = (typeof DOW_KEYS)[number]

export async function GET(req: NextRequest) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

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
  const now = new Date()

  if (scheduledAt <= now) {
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

  const dateStr = scheduledAt.toISOString().slice(0, 10)
  const dowKey = DOW_KEYS[scheduledAt.getUTCDay()] as DowKey

  const coachProfile = await CoachProfile.findOne({ userId: coachId }, 'workingHours')
  const dayHours = coachProfile?.workingHours?.[dowKey]

  if (!dayHours?.start || !dayHours?.end || !dayHours?.slotDuration) {
    return NextResponse.json({ error: 'Slot not within working hours' }, { status: 400 })
  }

  const slotTime = `${String(scheduledAt.getUTCHours()).padStart(2, '0')}:${String(scheduledAt.getUTCMinutes()).padStart(2, '0')}`
  const validSlots = generateSlots(dayHours.start, dayHours.end, dayHours.slotDuration)

  if (!validSlots.includes(slotTime)) {
    return NextResponse.json({ error: 'Slot not within working hours' }, { status: 400 })
  }

  const balance = await Balance.findOne({
    clientId: clientSession.userId,
    coachId,
  })
  const sessionsRemaining = balance ? balance.sessionsTotal - balance.sessionsUsed : 0
  if (sessionsRemaining <= 0) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 402 })
  }

  const conflict = await Session.findOne({
    coachId,
    scheduledAt,
    status: 'scheduled',
  })
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

  const balanceUpdate = await Balance.updateOne(
    { clientId: clientSession.userId, coachId },
    {
      $inc: { sessionsUsed: 1 },
      $push: {
        transactions: {
          type: 'debit',
          sessions: 1,
          recordedBy: clientSession.userId,
          createdAt: new Date(),
        },
      },
    }
  )

  if (balanceUpdate.modifiedCount === 0) {
    console.error(`Balance debit failed for client ${clientSession.userId}, session ${newSession._id}`)
    await Session.deleteOne({ _id: newSession._id })
    return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 })
  }

  return NextResponse.json({ session: newSession }, { status: 201 })
}
