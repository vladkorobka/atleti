import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, Balance, CoachProfile, CoachBlock } from '@atleti/db'
import type { AtletiSession, ICoachBlock } from '@atleti/types'
import { sessionUpdateSchema, sessionEditSchema } from '@/lib/validations/coach'
import { hasBlockingConflict, MAX_SESSION_DURATION_MIN } from '@/lib/session-conflict'
import { checkWithinSchedule, slotParts } from '@/lib/coach-schedule'

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

  // Умова по status робить перехід атомарним: між читанням `before` і записом статус
  // міг змінити settlePastSessions (він виконується на кожному читанні дашбордів).
  // Без цього фільтра ми б скоригували баланс за дельтою, якої вже не було, і
  // списали заняття двічі.
  let updatedSession
  try {
    updatedSession = await Session.findOneAndUpdate(
      { _id: params.sessionId, coachId: coachSession.userId, status: before.status },
      update,
      { new: true }
    )
  } catch (err) {
    // Вихід зі скасованого повертає заняття в індекс, а слот міг зайняти інший
    // запис того самого клієнта (напр. проведене, внесене заднім числом).
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: 'У цього клієнта вже є інше заняття на цей час' },
        { status: 409 }
      )
    }
    throw err
  }
  if (!updatedSession) {
    return NextResponse.json(
      { error: 'Статус заняття щойно змінився' },
      { status: 409 }
    )
  }

  // Баланс рахує лише проведені заняття. Коригуємо за дельтою «рахується як використане».
  const wasUsed = before.status === 'completed'
  const isUsed = status === 'completed'
  if (!wasUsed && isUsed) {
    // Симетрично до refund нижче: без цього запису перемикання статусу
    // «скасувати → позначити проведеним» накопичувало б у клієнта «Повернення»
    // без парних «Списань». upsert — з тієї ж причини, що й у POST: у клієнта
    // без жодного поповнення документа балансу ще немає.
    await Balance.updateOne(
      { clientId: before.clientId, coachId: coachSession.userId },
      {
        $inc: { sessionsUsed: 1 },
        $push: {
          transactions: {
            type: 'debit',
            sessions: 1,
            note: `Заняття ${slotParts(before.scheduledAt).date} позначене проведеним`,
            recordedBy: coachSession.userId,
          },
        },
      },
      { upsert: true }
    )
  } else if (wasUsed && !isUsed) {
    // не даємо піти в мінус. Пишемо refund у журнал: інакше списання, внесене
    // тренером заднім числом, лишилось би в історії клієнта після того, як
    // заняття перестало бути проведеним.
    await Balance.updateOne(
      { clientId: before.clientId, coachId: coachSession.userId, sessionsUsed: { $gte: 1 } },
      {
        $inc: { sessionsUsed: -1 },
        $push: {
          transactions: {
            type: 'refund',
            sessions: 1,
            note: `Заняття ${slotParts(before.scheduledAt).date} більше не проведене`,
            recordedBy: coachSession.userId,
          },
        },
      }
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

  const start = new Date(parsed.data.scheduledAt)

  // Лише в межах робочого графіку і поза блоками. Час — у київському поясі.
  const { date: slotDate, dowKey, startMin } = slotParts(start)
  const [coachProfile, coachBlocks] = await Promise.all([
    CoachProfile.findOne({ userId: coachSession.userId }, 'workingHours'),
    CoachBlock.find({ coachId: coachSession.userId }).lean() as unknown as Promise<ICoachBlock[]>,
  ])
  const schedCheck = checkWithinSchedule(
    coachProfile?.workingHours?.[dowKey], coachBlocks, slotDate, dowKey, startMin, startMin + parsed.data.duration
  )
  if (!schedCheck.ok) {
    return NextResponse.json({ error: schedCheck.error }, { status: 400 })
  }

  // Заборона переносу на зайнятий час (крім Спліт поверх Спліт). Виключаємо саме це заняття.
  const windowStart = new Date(start.getTime() - MAX_SESSION_DURATION_MIN * 60_000)
  const windowEnd = new Date(start.getTime() + parsed.data.duration * 60_000)
  const candidates = await Session.find({
    _id: { $ne: params.sessionId },
    coachId: coachSession.userId,
    status: 'scheduled',
    scheduledAt: { $gte: windowStart, $lt: windowEnd },
  }).select('scheduledAt duration type')

  if (hasBlockingConflict(start, parsed.data.duration, parsed.data.type, candidates)) {
    return NextResponse.json(
      { error: 'На цей час уже заплановано заняття. Поверх можна додати лише Спліт-заняття.' },
      { status: 409 }
    )
  }

  let updatedSession
  try {
    updatedSession = await Session.findOneAndUpdate(
      { _id: params.sessionId, coachId: coachSession.userId, status: 'scheduled' },
      { scheduledAt: parsed.data.scheduledAt, duration: parsed.data.duration, type: parsed.data.type },
      { new: true }
    )
  } catch (err) {
    // uniq_coach_client_slot: у клієнта вже є заняття на цей час. Перевірка вище
    // цього не ловить — вона дивиться лише на scheduled, а проведене (записане
    // заднім числом) теж займає слот.
    if ((err as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: 'У цього клієнта вже є заняття на цей час' },
        { status: 409 }
      )
    }
    throw err
  }

  if (!updatedSession) return NextResponse.json({ error: 'Session not found or not editable' }, { status: 404 })
  return NextResponse.json({ session: updatedSession })
}

// Скасування заняття тренером = видалення з розкладу (а не статус "cancelled").
// Якщо заняття було проведене — повертаємо списане заняття на баланс.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const existing = await Session.findOne({ _id: params.sessionId, coachId: coachSession.userId })
  if (!existing) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

  if (existing.status === 'completed') {
    // Разом із поверненням пишемо refund: діалог скасування прямо обіцяє клієнту
    // повернення, і без запису в історії лишилось би списання за заняття, якого
    // більше немає.
    await Balance.updateOne(
      { clientId: existing.clientId, coachId: coachSession.userId, sessionsUsed: { $gte: 1 } },
      {
        $inc: { sessionsUsed: -1 },
        $push: {
          transactions: {
            type: 'refund',
            sessions: 1,
            note: `Скасовано проведене заняття ${slotParts(existing.scheduledAt).date}`,
            recordedBy: coachSession.userId,
          },
        },
      }
    )
  }

  await Session.deleteOne({ _id: params.sessionId, coachId: coachSession.userId })

  return NextResponse.json({ ok: true })
}
