import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, ClientCoach, CoachProfile, CoachBlock, Balance } from '@atleti/db'
import type { AtletiSession, ICoachBlock } from '@atleti/types'
import { sessionCreateSchema } from '@/lib/validations/coach'
import { settlePastSessions } from '@/lib/settle-sessions'
import { hasBlockingConflict, MAX_SESSION_DURATION_MIN } from '@/lib/session-conflict'
import { checkWithinSchedule, slotParts } from '@/lib/coach-schedule'

export async function GET(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  await settlePastSessions({ coachId: coachSession.userId })

  const url = new URL(req.url)
  const month = url.searchParams.get('month') // format: "2026-05"

  const query: Record<string, unknown> = { coachId: coachSession.userId }
  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 1)
    query.scheduledAt = { $gte: start, $lt: end }
  }

  const sessions = await Session.find(query).populate('clientId', 'name nickname').sort({ scheduledAt: 1 })
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const body = await req.json()
  const parsed = sessionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { clientId, scheduledAt, duration, type } = parsed.data

  const relationship = await ClientCoach.findOne({
    clientId: parsed.data.clientId,
    coachId: coachSession.userId,
    status: 'active',
  })
  if (!relationship) {
    return NextResponse.json({ error: 'Клієнт не належить до вашого списку' }, { status: 403 })
  }

  const start = new Date(scheduledAt)
  if (start <= new Date()) {
    return NextResponse.json({ error: 'Дата заняття має бути в майбутньому' }, { status: 400 })
  }

  // Баланс: не плануємо понад оплачений пакет. Заплановані заняття — це резерв
  // (completed + scheduled не може перевищити sessionsTotal), тож при нульовому
  // залишку додавати заняття не можна.
  const balance = await Balance.findOne({ clientId, coachId: coachSession.userId })
  const total = balance?.sessionsTotal ?? 0
  const used = balance?.sessionsUsed ?? 0
  const reserved = await Session.countDocuments({
    clientId,
    coachId: coachSession.userId,
    status: 'scheduled',
  })
  if (used + reserved >= total) {
    return NextResponse.json(
      { error: 'У клієнта немає вільних занять на балансі. Поповніть баланс, щоб додати заняття.' },
      { status: 402 }
    )
  }

  // Лише в межах робочого графіку і поза блоками (обід тощо). Час — у київському поясі.
  const { date: slotDate, dowKey, startMin } = slotParts(start)
  const [coachProfile, coachBlocks] = await Promise.all([
    CoachProfile.findOne({ userId: coachSession.userId }, 'workingHours'),
    CoachBlock.find({ coachId: coachSession.userId }).lean() as unknown as Promise<ICoachBlock[]>,
  ])
  const schedCheck = checkWithinSchedule(
    coachProfile?.workingHours?.[dowKey], coachBlocks, slotDate, dowKey, startMin, startMin + duration
  )
  if (!schedCheck.ok) {
    return NextResponse.json({ error: schedCheck.error }, { status: 400 })
  }

  // Заборона подвійного бронювання (крім Спліт поверх Спліт). Перетин рахуємо на абсолютних інтервалах.
  const windowStart = new Date(start.getTime() - MAX_SESSION_DURATION_MIN * 60_000)
  const windowEnd = new Date(start.getTime() + duration * 60_000)
  const candidates = await Session.find({
    coachId: coachSession.userId,
    status: 'scheduled',
    scheduledAt: { $gte: windowStart, $lt: windowEnd },
  }).select('scheduledAt duration type')

  if (hasBlockingConflict(start, duration, type, candidates)) {
    return NextResponse.json(
      { error: 'На цей час уже заплановано заняття. Поверх можна додати лише Спліт-заняття.' },
      { status: 409 }
    )
  }

  const newSession = await Session.create({
    clientId,
    coachId: coachSession.userId,
    scheduledAt: start,
    duration,
    type,
    status: 'scheduled',
    createdBy: 'coach',
  })

  return NextResponse.json({ session: newSession }, { status: 201 })
}
