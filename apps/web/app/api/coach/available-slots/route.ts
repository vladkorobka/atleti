import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, CoachProfile, Session, CoachBlock } from '@atleti/db'
import type { AtletiSession, ICoachBlock, DowKey } from '@atleti/types'
import { generateSlots, isDayBlocked, getBlockedSlots } from '@/lib/slot-utils'

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export async function GET(req: NextRequest) {
  const session = await auth()
  const clientSession = session?.user as unknown as AtletiSession
  if (!clientSession || clientSession.role !== 'client') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  await ensureDB()

  const relationship = await ClientCoach.findOne({
    clientId: clientSession.userId,
    status: 'active',
  })
  if (!relationship) {
    return NextResponse.json({ error: 'No active coach' }, { status: 404 })
  }
  const coachId = relationship.coachId.toString()

  const coachProfile = await CoachProfile.findOne({ userId: coachId }, 'workingHours')
  if (!coachProfile) {
    return NextResponse.json({ slots: [] })
  }

  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59.999`)
  const dowKey = DOW_KEYS[dayStart.getDay()] as DowKey
  const dayHours = coachProfile.workingHours?.[dowKey]

  if (!dayHours?.start || !dayHours?.end || !dayHours?.slotDuration) {
    return NextResponse.json({ slots: [] })
  }

  const allSlots = generateSlots(dayHours.start, dayHours.end, dayHours.slotDuration)

  const blocks = await CoachBlock.find({ coachId: relationship.coachId }).lean() as unknown as ICoachBlock[]

  if (isDayBlocked(blocks, date, dowKey)) {
    return NextResponse.json({ slots: [] })
  }

  const blockedSlotSet = new Set(getBlockedSlots(blocks, date, dowKey, allSlots, dayHours.slotDuration))

  const bookedSessions = await Session.find({
    coachId: relationship.coachId,
    scheduledAt: { $gte: dayStart, $lte: dayEnd },
    status: 'scheduled',
  }).select('scheduledAt')

  const bookedTimes = new Set(
    bookedSessions.map(s => {
      const d = new Date(s.scheduledAt)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    })
  )

  const now = new Date()
  const available = allSlots.filter(slot => {
    if (blockedSlotSet.has(slot)) return false
    if (bookedTimes.has(slot)) return false
    const [h, m] = slot.split(':').map(Number)
    const slotDate = new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`)
    return slotDate > now
  })

  return NextResponse.json({ slots: available })
}
