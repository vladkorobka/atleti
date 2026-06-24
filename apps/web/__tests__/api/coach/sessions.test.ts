import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { kyivInputToUtc } from '@/lib/tz'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string

// Фіксований майбутній робочий день. at() будує момент так, щоб КИЇВСЬКИЙ настінний час
// дорівнював t (графік і блоки задані в київському настінному часі).
const DAY = '2030-06-17'
const at = (t: string) => kyivInputToUtc(DAY, t).toISOString()

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
  coachId = coach._id.toString()
  clientId = client._id.toString()
  await ClientCoach.create({ clientId: client._id, coachId: coach._id, status: 'active' })
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
  })

  it('regular поверх regular на той самий час → 409', async () => {
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(201)
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'regular' })).status).toBe(409)
  })

  it('split поверх split → 201', async () => {
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'split' })).status).toBe(201)
    expect((await postSession({ clientId, scheduledAt: at('10:00'), duration: 60, type: 'split' })).status).toBe(201)
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
