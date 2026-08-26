import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, ClientCoach, CoachProfile, CoachBlock, Balance } from '@atleti/db'
import type { AtletiSession, ICoachBlock } from '@atleti/types'
import { sessionCreateSchema } from '@/lib/validations/coach'
import { settlePastSessions } from '@/lib/settle-sessions'
import { hasBlockingConflict, MAX_SESSION_DURATION_MIN, MAX_BACKDATE_DAYS } from '@/lib/session-conflict'
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
  const { clientId, scheduledAt, duration, type, status } = parsed.data

  const relationship = await ClientCoach.findOne({
    clientId: parsed.data.clientId,
    coachId: coachSession.userId,
    status: 'active',
  })
  if (!relationship) {
    return NextResponse.json({ error: 'Клієнт не належить до вашого списку' }, { status: 403 })
  }

  const start = new Date(scheduledAt)
  // Ретроактивний запис: заняття вже відбулось у реальності, тож фіксуємо його
  // одразу як проведене. Майбутнє, навпаки, не можна позначити проведеним наперед.
  const isPast = start <= new Date()
  if (isPast && status !== 'completed') {
    return NextResponse.json(
      { error: 'Заняття в минулому можна записати лише як проведене' },
      { status: 400 }
    )
  }
  if (!isPast && status === 'completed') {
    return NextResponse.json(
      { error: 'Майбутнє заняття не можна одразу позначити проведеним' },
      { status: 400 }
    )
  }
  if (isPast && start.getTime() < Date.now() - MAX_BACKDATE_DAYS * 86_400_000) {
    return NextResponse.json(
      { error: 'Заняття можна записати заднім числом не більше ніж за рік' },
      { status: 400 }
    )
  }

  // Баланс: не плануємо понад оплачений пакет. Заплановані заняття — це резерв
  // (completed + scheduled не може перевищити sessionsTotal), тож при нульовому
  // залишку додавати заняття не можна.
  // Для минулого перевірку не робимо: факт уже стався, баланс може піти в мінус.
  if (!isPast) {
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
  }

  // Лише в межах робочого графіку і поза блоками (обід тощо). Час — у київському поясі.
  // Минуле не звіряємо з графіком: він міг змінитись, а заняття могло бути позаплановим.
  if (!isPast) {
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
  }

  // Заборона подвійного бронювання (крім Спліт поверх Спліт). Перетин рахуємо на абсолютних інтервалах.
  // Для минулого враховуємо і вже проведені заняття — інакше один і той самий факт
  // можна було б записати двічі.
  const windowStart = new Date(start.getTime() - MAX_SESSION_DURATION_MIN * 60_000)
  const windowEnd = new Date(start.getTime() + duration * 60_000)
  const candidates = await Session.find({
    coachId: coachSession.userId,
    status: { $in: isPast ? ['scheduled', 'completed'] : ['scheduled'] },
    scheduledAt: { $gte: windowStart, $lt: windowEnd },
  }).select('scheduledAt duration type')

  if (hasBlockingConflict(start, duration, type, candidates)) {
    return NextResponse.json(
      { error: isPast
          ? 'На цей час уже є заняття. Поверх можна записати лише Спліт-заняття.'
          : 'На цей час уже заплановано заняття. Поверх можна додати лише Спліт-заняття.' },
      { status: 409 }
    )
  }

  const newSession = await Session.create({
    clientId,
    coachId: coachSession.userId,
    scheduledAt: start,
    duration,
    type,
    status: isPast ? 'completed' : 'scheduled',
    createdBy: 'coach',
  })

  // Проведене заняття списується з балансу одразу — на відміну від запланованого,
  // яке спише settlePastSessions після настання часу. upsert: у клієнта без жодного
  // поповнення документа балансу ще немає, а борг зафіксувати треба.
  if (isPast) {
    try {
      await Balance.updateOne(
        { clientId, coachId: coachSession.userId },
        { $inc: { sessionsUsed: 1 } },
        { upsert: true }
      )
    } catch (err) {
      // Проведене заняття без списання не звірить ніхто: settlePastSessions дивиться
      // лише на scheduled. Відкочуємо створення, щоб не лишити його безкоштовним.
      await Session.deleteOne({ _id: newSession._id })
      throw err
    }
  }

  return NextResponse.json({ session: newSession }, { status: 201 })
}
