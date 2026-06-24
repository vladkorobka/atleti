import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { ClientCoach, CoachProfile, Session, CoachBlock } from '@atleti/db'
import type { AtletiSession, ICoachBlock, DowKey } from '@atleti/types'
import { generateSlots, isDayBlocked, getBlockedSlots } from '@/lib/slot-utils'
import { kyivInputToUtc, kyivParts } from '@/lib/tz'

const DOW_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const pad = (n: number) => String(n).padStart(2, '0')

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

  // date — київська календарна дата; день тижня рахуємо саме з неї
  const [yy, mm, dd] = date.split('-').map(Number)
  const dowKey = DOW_KEYS[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()] as DowKey
  // межі київської доби в UTC — для вибірки заброньованих занять
  const dayStart = kyivInputToUtc(date, '00:00')
  const dayEnd = kyivInputToUtc(date, '23:59')
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

  // настінний (київський) час кожного заброньованого заняття
  const bookedTimes = new Set(
    bookedSessions.map(s => {
      const p = kyivParts(new Date(s.scheduledAt))
      return `${pad(p.hour)}:${pad(p.minute)}`
    })
  )

  const now = new Date()
  const available = allSlots.filter(slot => {
    if (blockedSlotSet.has(slot)) return false
    if (bookedTimes.has(slot)) return false
    // реальний момент слоту (київський настінний → UTC) має бути в майбутньому
    return kyivInputToUtc(date, slot) > now
  })

  return NextResponse.json({ slots: available })
}
