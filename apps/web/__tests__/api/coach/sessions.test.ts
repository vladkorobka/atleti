import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { kyivInputToUtc, kyivDateInput } from '@/lib/tz'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string
// Другий клієнт потрібен для Спліт-тестів: індекс uniq_coach_client_slot забороняє
// два заняття одного клієнта в один момент, а спліт — це саме різні клієнти.
let client2Id: string

// Фіксований майбутній робочий день. at() будує момент так, щоб КИЇВСЬКИЙ настінний час
// дорівнював t (графік і блоки задані в київському настінному часі).
const DAY = '2030-06-17'
const at = (t: string) => kyivInputToUtc(DAY, t).toISOString()

// Минулий день для ретроактивного запису. Рахуємо відносно «сьогодні», а не фіксованою
// датою: запис заднім числом обмежений MAX_BACKDATE_DAYS, тож жорстка дата з часом
// вийшла б за межу і тести почали б падати.
const PAST_DAY = kyivDateInput(new Date(Date.now() - 30 * 86_400_000))
const pastAt = (t: string) => kyivInputToUtc(PAST_DAY, t).toISOString()

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null)
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, Session, ClientCoach, CoachProfile } = await import('@atleti/db')
  await User.ensureIndexes()
  await Session.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })
  const client2 = await User.create({ email: 'client2@test.com', name: 'Client Two', role: 'client', nickname: 'client2' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
  client2Id = client2._id.toString()
  await ClientCoach.create({ clientId: client._id, coachId: coach._id, status: 'active' })
  await ClientCoach.create({ clientId: client2._id, coachId: coach._id, status: 'active' })
  // Графік 09:00–18:00 на всі дні, щоб тести не залежали від дня тижня
  const wh = { start: '09:00', end: '18:00', slotDuration: 60 }
  await CoachProfile.create({
    userId: coach._id,
    workingHours: { mon: wh, tue: wh, wed: wh, thu: wh, fri: wh, sat: wh, sun: wh },
  })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { Session, CoachBlock, Balance } = await import('@atleti/db')
  await Session.deleteMany({})
  await CoachBlock.deleteMany({})
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
  } as any)
})

async function postSession(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/coach/sessions/route')
  const req = new Request('http://localhost/api/coach/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return POST(req as any)
}

describe('POST /api/coach/sessions', () => {
  beforeEach(async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 100, sessionsUsed: 0, transactions: [] })
  })

  it('creates a session', async () => {
    const res = await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.session.status).toBe('scheduled')
    expect(data.session.createdBy).toBe('coach')
  })

  it('blocks adding when client has no balance left → 402', async () => {
    const { Balance } = await import('@atleti/db')
    // Заповнюємо весь пакет використаними заняттями — вільних немає
    await Balance.updateOne({ clientId, coachId }, { sessionsTotal: 2, sessionsUsed: 2 })
    const res = await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })
    expect(res.status).toBe(402)
  })

  it('blocks adding when reservations already fill the package → 402', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.updateOne({ clientId, coachId }, { sessionsTotal: 1, sessionsUsed: 0 })
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(201)
    // другий слот — пакет вичерпано резервом
    expect((await postSession({ clientId, scheduledAt: at('11:00'), duration: 60, type: 'regular' })).status).toBe(402)
  })
})

describe('POST /api/coach/sessions — у межах графіку та блоки', () => {
  beforeEach(async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 100, sessionsUsed: 0, transactions: [] })
  })

  it('поза робочими годинами (02:00) → 400', async () => {
    expect((await postSession({ clientId, scheduledAt: at('02:00'), duration: 60, type: 'regular' })).status).toBe(400)
  })

  it('кінець за межами графіку (17:30 + 60 хв) → 400', async () => {
    expect((await postSession({ clientId, scheduledAt: at('17:30'), duration: 60, type: 'regular' })).status).toBe(400)
  })

  it('у межах графіку (10:00) → 201', async () => {
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(201)
  })

  it('поверх обідньої перерви 12:00–13:00 → 400', async () => {
    const { CoachBlock } = await import('@atleti/db')
    await CoachBlock.create({ coachId, type: 'time', date: DAY, startTime: '12:00', endTime: '13:00', label: 'Обід' })
    expect((await postSession({ clientId, scheduledAt: at('12:00'), duration: 60, type: 'regular' })).status).toBe(400)
  })

  it('одразу після обіду (13:00) → 201', async () => {
    const { CoachBlock } = await import('@atleti/db')
    await CoachBlock.create({ coachId, type: 'time', date: DAY, startTime: '12:00', endTime: '13:00', label: 'Обід' })
    expect((await postSession({ clientId, scheduledAt: at('13:00'), duration: 60, type: 'regular' })).status).toBe(201)
  })
})

describe('POST /api/coach/sessions — конфлікти', () => {
  beforeEach(async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 100, sessionsUsed: 0, transactions: [] })
    await Balance.create({ clientId: client2Id, coachId, sessionsTotal: 100, sessionsUsed: 0, transactions: [] })
  })

  it('regular поверх regular на той самий час → 409', async () => {
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(201)
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(409)
  })

  it('split поверх split (різні клієнти) → 201', async () => {
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'split' })).status).toBe(201)
    expect((await postSession({ clientId: client2Id, scheduledAt: at('10:00'), duration: 60, type: 'split' })).status).toBe(201)
  })

  it('два заняття ОДНОГО клієнта на той самий час → 409 навіть для split', async () => {
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'split' })).status).toBe(201)
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'split' })).status).toBe(409)
  })

  it('split поверх regular → 409', async () => {
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(201)
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'split' })).status).toBe(409)
  })

  it('перетин зі скасованим заняттям → 201', async () => {
    const { Session } = await import('@atleti/db')
    await Session.create({
      clientId, coachId, scheduledAt: new Date(at('10:00')), duration: 60, type: 'regular',
      status: 'cancelled', createdBy: 'coach',
    })
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(201)
  })
})

describe('POST /api/coach/sessions — ретроактивний запис проведеного заняття', () => {
  beforeEach(async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 100, sessionsUsed: 0, transactions: [] })
  })

  it('минула дата зі status=completed → 201, заняття проведене, баланс списано', async () => {
    const { Balance } = await import('@atleti/db')
    const res = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.session.status).toBe('completed')
    expect(data.session.createdBy).toBe('coach')
    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(1)
    // Ручне списання заднім числом має лишати слід в історії — інакше клієнт
    // побачив би зміну балансу без жодного пояснення.
    expect(bal?.transactions).toHaveLength(1)
    expect(bal?.transactions[0].type).toBe('debit')
    expect(bal?.transactions[0].sessions).toBe(1)
    expect(bal?.transactions[0].note).toContain(PAST_DAY)
    expect(bal?.transactions[0].recordedBy?.toString()).toBe(coachId)
  })

  it('відхилений дубль не лишає запису в історії', async () => {
    const { Balance } = await import('@atleti/db')
    await postSession({ clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed' })
    await postSession({ clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed' })
    expect((await Balance.findOne({ clientId, coachId }))?.transactions).toHaveLength(1)
  })

  it('заплановане наперед заняття не пише в історію', async () => {
    const { Balance } = await import('@atleti/db')
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(201)
    expect((await Balance.findOne({ clientId, coachId }))?.transactions).toHaveLength(0)
  })

  it('минуле не можна запланувати: без status → 400 з поясненням', async () => {
    const res = await postSession({ clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Заняття в минулому можна записати лише як проведене')
  })

  it('минуле не можна запланувати: явний status=scheduled → 400 з поясненням', async () => {
    const res = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'scheduled',
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Заняття в минулому можна записати лише як проведене')
  })

  it('майбутнє не можна позначити проведеним наперед → 400 з поясненням', async () => {
    const res = await postSession({
      clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Майбутнє заняття не можна одразу позначити проведеним')
  })

  it('глибше за рік у минуле → 400', async () => {
    const tooOld = new Date(Date.now() - 400 * 86_400_000).toISOString()
    const res = await postSession({ clientId, scheduledAt: tooOld, duration: 60, type: 'regular', status: 'completed' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Заняття можна записати заднім числом не більше ніж за рік')
  })

  it('у межах року в минуле → 201', async () => {
    const recent = new Date(Date.now() - 300 * 86_400_000).toISOString()
    const res = await postSession({ clientId, scheduledAt: recent, duration: 60, type: 'regular', status: 'completed' })
    expect(res.status).toBe(201)
  })

  it('момент рівно «зараз» вважається минулим', async () => {
    // Межа `start <= now`. Фіксуємо лише Date — таймери лишаються справжніми,
    // інакше зависли б операції mongodb-memory-server.
    const fixed = new Date('2026-08-26T09:00:00.000Z')
    vi.useFakeTimers({ toFake: ['Date'], now: fixed })
    try {
      const res = await postSession({
        clientId, scheduledAt: fixed.toISOString(), duration: 60, type: 'regular', status: 'completed',
      })
      expect(res.status).toBe(201)
      expect((await res.json()).session.status).toBe('completed')
    } finally {
      vi.useRealTimers()
    }
  })

  it('заняття, що триває зараз, фіксується як проведене (як і settlePastSessions)', async () => {
    // isPast рахується за початком, а не за кінцем — навмисно, щоб збігатися з
    // settlePastSessions, який закриває заняття за scheduledAt <= now.
    const { Balance } = await import('@atleti/db')
    const startedAgo = new Date(Date.now() - 30 * 60_000).toISOString()
    const res = await postSession({ clientId, scheduledAt: startedAgo, duration: 60, type: 'regular', status: 'completed' })
    expect(res.status).toBe(201)
    expect((await Balance.findOne({ clientId, coachId }))?.sessionsUsed).toBe(1)
  })

  it('минуле поза робочими годинами (02:00) → 201 (графік не перевіряється)', async () => {
    const res = await postSession({
      clientId, scheduledAt: pastAt('02:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(res.status).toBe(201)
  })

  it('минуле поверх блоку (обід) → 201 (блоки не перевіряються)', async () => {
    const { CoachBlock } = await import('@atleti/db')
    await CoachBlock.create({ coachId, type: 'time', date: PAST_DAY, startTime: '12:00', endTime: '13:00', label: 'Обід' })
    const res = await postSession({
      clientId, scheduledAt: pastAt('12:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(res.status).toBe(201)
  })

  it('минуле при нульовому балансі → 201, залишок іде в мінус', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.updateOne({ clientId, coachId }, { sessionsTotal: 2, sessionsUsed: 2 })
    const res = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(res.status).toBe(201)
    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal!.sessionsTotal - bal!.sessionsUsed).toBe(-1)
  })

  it('минуле для клієнта без документа балансу → 201, борг створено через upsert', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.deleteMany({})
    const res = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(res.status).toBe(201)
    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(1)
    expect(bal!.sessionsTotal - bal!.sessionsUsed).toBe(-1)
  })

  it('минуле поверх уже проведеного заняття в той самий час → 409 і баланс не зачеплено', async () => {
    const { Balance } = await import('@atleti/db')
    expect((await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })).status).toBe(201)
    expect((await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })).status).toBe(409)
    // Відхилений дубль не має списувати заняття — інакше перенос списання вище
    // по файлу пройшов би непоміченим.
    expect((await Balance.findOne({ clientId, coachId }))?.sessionsUsed).toBe(1)
  })

  it('два минулі Спліт-заняття різних клієнтів → обидва 201, списано з кожного', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId: client2Id, coachId, sessionsTotal: 100, sessionsUsed: 0, transactions: [] })
    expect((await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'split', status: 'completed',
    })).status).toBe(201)
    expect((await postSession({
      clientId: client2Id, scheduledAt: pastAt('10:00'), duration: 60, type: 'split', status: 'completed',
    })).status).toBe(201)
    expect((await Balance.findOne({ clientId, coachId }))?.sessionsUsed).toBe(1)
    expect((await Balance.findOne({ clientId: client2Id, coachId }))?.sessionsUsed).toBe(1)
  })

  it('минуле поверх скасованого заняття → 201', async () => {
    const { Session } = await import('@atleti/db')
    await Session.create({
      clientId, coachId, scheduledAt: new Date(pastAt('10:00')), duration: 60, type: 'regular',
      status: 'cancelled', createdBy: 'coach',
    })
    const res = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(res.status).toBe(201)
  })

  it('планування наперед ігнорує проведені заняття у вікні кандидатів', async () => {
    // Вікно кандидатів для майбутнього не включає completed — інакше вже проведені
    // заняття блокували б планування. Перевіряємо, що гілка isPast не протекла.
    // Проведене заняття беремо в іншого клієнта: вікно конфліктів рахується по
    // тренеру, а того самого клієнта на той самий час не пустив би унікальний індекс.
    const { Session } = await import('@atleti/db')
    await Session.create({
      clientId: client2Id, coachId, scheduledAt: new Date(at('10:00')), duration: 60, type: 'regular',
      status: 'completed', createdBy: 'coach',
    })
    const res = await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })
    expect(res.status).toBe(201)
  })

  it('DELETE ретроактивного заняття пише refund — історія не бреше', async () => {
    const { Balance } = await import('@atleti/db')
    const created = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    const sessionId = (await created.json()).session._id as string

    const { DELETE } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const res = await DELETE(
      new Request(`http://localhost/api/coach/sessions/${sessionId}`, { method: 'DELETE' }) as any,
      { params: { sessionId } }
    )
    expect(res.status).toBe(200)

    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(0)
    // Без refund у клієнта лишилось би списання за заняття, якого вже не існує
    expect(bal?.transactions).toHaveLength(2)
    expect(bal?.transactions[0].type).toBe('debit')
    expect(bal?.transactions[1].type).toBe('refund')
    expect(bal?.transactions[1].sessions).toBe(1)
    // Журнал сходиться з балансом: списано 1, повернено 1
    const net = bal!.transactions.reduce((acc, t) => acc + (t.type === 'debit' ? t.sessions : -t.sessions), 0)
    expect(net).toBe(0)
  })

  it('PUT зі скасованого на зайнятий слот → 409, не 500', async () => {
    // Скасоване заняття поза індексом; повернення в scheduled заводить його назад,
    // а слот того самого клієнта вже зайнятий проведеним заняттям.
    const { Session } = await import('@atleti/db')
    const cancelled = await Session.create({
      clientId, coachId, scheduledAt: new Date(pastAt('10:00')), duration: 60, type: 'regular',
      status: 'cancelled', createdBy: 'coach',
    })
    await Session.create({
      clientId, coachId, scheduledAt: new Date(pastAt('10:00')), duration: 60, type: 'regular',
      status: 'completed', createdBy: 'coach',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const sessionId = cancelled._id.toString()
    const res = await PUT(
      new Request(`http://localhost/api/coach/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'scheduled' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any,
      { params: { sessionId } }
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('У цього клієнта вже є інше заняття на цей час')
  })

  it('PUT «більше не проведене» теж пише refund', async () => {
    const { Balance } = await import('@atleti/db')
    const created = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    const sessionId = (await created.json()).session._id as string

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    await PUT(
      new Request(`http://localhost/api/coach/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelled', cancelReason: 'помилковий запис' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any,
      { params: { sessionId } }
    )

    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(0)
    expect(bal?.transactions.map(t => t.type)).toEqual(['debit', 'refund'])
  })

  // Негайне списання в POST співіснує з лінивим settlePastSessions, з PUT і з DELETE.
  // Інваріант: sessionsUsed завжди дорівнює кількості проведених занять.
  it('інваріант балансу через ланцюжок POST(минуле) → settle → PUT → settle → DELETE', async () => {
    const { Session, Balance } = await import('@atleti/db')
    const { settlePastSessions } = await import('@/lib/settle-sessions')
    const used = async () => (await Balance.findOne({ clientId, coachId }))?.sessionsUsed
    const completed = () => Session.countDocuments({ clientId, coachId, status: 'completed' })

    const created = await postSession({
      clientId, scheduledAt: pastAt('10:00'), duration: 60, type: 'regular', status: 'completed',
    })
    expect(created.status).toBe(201)
    const sessionId = (await created.json()).session._id as string
    expect(await used()).toBe(1)
    expect(await completed()).toBe(1)

    // Повторні читання дашбордів не списують удруге
    await settlePastSessions({ coachId })
    await settlePastSessions({ coachId })
    expect(await used()).toBe(1)
    expect(await completed()).toBe(1)

    // Спроба «розпровести» минуле заняття: PUT знімає списання, але наступний settle
    // повертає заняття в completed і списання разом з ним. Баланс лишається чесним.
    const { PUT, DELETE } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const putRes = await PUT(
      new Request(`http://localhost/api/coach/sessions/${sessionId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'scheduled' }),
        headers: { 'Content-Type': 'application/json' },
      }) as any,
      { params: { sessionId } }
    )
    expect(putRes.status).toBe(200)
    expect(await used()).toBe(0)
    expect(await completed()).toBe(0)

    await settlePastSessions({ coachId })
    expect(await used()).toBe(1)
    expect(await completed()).toBe(1)

    // Видалення повертає списане заняття на баланс
    const delRes = await DELETE(
      new Request(`http://localhost/api/coach/sessions/${sessionId}`, { method: 'DELETE' }) as any,
      { params: { sessionId } }
    )
    expect(delRes.status).toBe(200)
    expect(await used()).toBe(0)
    expect(await completed()).toBe(0)
  })
})

describe('PATCH /api/coach/sessions/[sessionId] — конфлікти', () => {
  async function patch(sessionId: string, body: Record<string, unknown>) {
    const { PATCH } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    return PATCH(req as any, { params: { sessionId } })
  }

  it('перенос на зайнятий час → 409', async () => {
    const { Session } = await import('@atleti/db')
    await Session.create({ clientId, coachId, scheduledAt: new Date(at('10:00')), duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach' })
    const b = await Session.create({ clientId, coachId, scheduledAt: new Date(at('11:00')), duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach' })
    const res = await patch(b._id.toString(), { scheduledAt: at('10:00'), duration: 60, type: 'regular' })
    expect(res.status).toBe(409)
  })

  it('перенос самого себе на свій же час → 200 (виключення себе)', async () => {
    const { Session } = await import('@atleti/db')
    const s = await Session.create({ clientId, coachId, scheduledAt: new Date(at('10:00')), duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach' })
    const res = await patch(s._id.toString(), { scheduledAt: at('10:00'), duration: 90, type: 'regular' })
    expect(res.status).toBe(200)
  })

  it('перенос на час, де в клієнта вже є проведене заняття → 409, не 500', async () => {
    // Перевірка конфліктів у PATCH дивиться лише на scheduled, тож проведене
    // заняття ловиться вже унікальним індексом. Помилка має бути осмисленою.
    const { Session, Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 100, sessionsUsed: 0, transactions: [] })
    await Session.create({
      clientId, coachId, scheduledAt: new Date(at('10:00')), duration: 60, type: 'regular',
      status: 'completed', createdBy: 'coach',
    })
    const s = await Session.create({
      clientId, coachId, scheduledAt: new Date(at('11:00')), duration: 60, type: 'regular',
      status: 'scheduled', createdBy: 'coach',
    })
    const res = await patch(s._id.toString(), { scheduledAt: at('10:00'), duration: 60, type: 'regular' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('У цього клієнта вже є заняття на цей час')
  })

  it('перенос поза межами графіку (02:00) → 400', async () => {
    const { Session } = await import('@atleti/db')
    const s = await Session.create({ clientId, coachId, scheduledAt: new Date(at('10:00')), duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach' })
    const res = await patch(s._id.toString(), { scheduledAt: at('02:00'), duration: 60, type: 'regular' })
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/coach/sessions/[sessionId]', () => {
  it('coach can change session status to completed', async () => {
    const { Session } = await import('@atleti/db')
    const session = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('completed')
  })

  it('coach can cancel session with reason', async () => {
    const { Session } = await import('@atleti/db')
    const session = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'client',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled', cancelReason: 'Захворів' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('cancelled')
    expect(data.session.cancelledByRole).toBe('coach')
    expect(data.session.cancelReason).toBe('Захворів')
  })

  it('reconciles balance: completed -> cancelled decrements sessionsUsed', async () => {
    const { Session, Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 5, sessionsUsed: 1 })
    const session = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'completed', createdBy: 'coach',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled', cancelReason: 'помилка' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(200)
    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(0)
  })

  it('reconciles balance: cancelled -> completed increments and clears cancel meta', async () => {
    const { Session, Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 5, sessionsUsed: 0 })
    const session = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'cancelled', cancelReason: 'старе',
      cancelledByRole: 'coach', createdBy: 'coach',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'completed' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('completed')
    expect(data.session.cancelReason == null || data.session.cancelReason === '').toBe(true)
    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(1)
  })

  it('does not drive sessionsUsed below zero', async () => {
    const { Session, Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 5, sessionsUsed: 0 })
    const session = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'completed', createdBy: 'coach',
    })

    const { PUT } = await import('@/app/api/coach/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/coach/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'scheduled' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await PUT(req as any, { params: { sessionId: session._id.toString() } })
    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(0)
  })
})
