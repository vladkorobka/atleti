import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { kyivInputToUtc } from '@/lib/tz'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string

const DAY = '2030-06-17'
const at = (t: string) => kyivInputToUtc(DAY, t).toISOString()

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, ClientCoach, CoachProfile } = await import('@atleti/db')
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
  await ClientCoach.create({ clientId: client._id, coachId, status: 'active' })
  const wh = { start: '09:00', end: '18:00', slotDuration: 60 }
  await CoachProfile.create({
    userId: coachId,
    workingHours: { mon: wh, tue: wh, wed: wh, thu: wh, fri: wh, sat: wh, sun: wh },
  })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { Session, Balance } = await import('@atleti/db')
  await Session.deleteMany({})
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'client@test.com', userId: clientId, role: 'client', nickname: 'client1', name: 'Client' }
  } as any)
})

async function book(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/client/sessions/route')
  const req = new Request('http://localhost/api/client/sessions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return POST(req as any)
}

describe('POST /api/client/sessions — booking', () => {
  it('books a slot within working hours without debiting (debit on completion)', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 3, sessionsUsed: 0 })

    const res = await book({ scheduledAt: at('10:00'), type: 'regular' })
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.session.createdBy).toBe('client')
    expect(data.session.duration).toBe(60)

    // бронювання лише резервує — баланс не змінюється до завершення заняття
    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(0)
    expect(bal?.transactions.length).toBe(0)
  })

  it('rejects booking with no remaining capacity → 402', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 1, sessionsUsed: 1 })
    expect((await book({ scheduledAt: at('10:00'), type: 'regular' })).status).toBe(402)
  })

  it('counts existing reservations against capacity → 402 when full', async () => {
    const { Balance, Session } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 1, sessionsUsed: 0 })
    // одне заплановане заняття вже зайняло всю місткість пакета
    await Session.create({
      clientId, coachId, scheduledAt: new Date(at('11:00')), duration: 60, type: 'regular',
      status: 'scheduled', createdBy: 'client',
    })
    expect((await book({ scheduledAt: at('10:00'), type: 'regular' })).status).toBe(402)
  })

  it('rejects an already-booked slot → 409', async () => {
    const { Balance, Session } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 3, sessionsUsed: 0 })
    await Session.create({
      clientId, coachId, scheduledAt: new Date(at('10:00')), duration: 60, type: 'regular',
      status: 'scheduled', createdBy: 'coach',
    })
    expect((await book({ scheduledAt: at('10:00'), type: 'regular' })).status).toBe(409)
  })

  it('rejects a slot outside working hours → 400', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({ clientId, coachId, sessionsTotal: 3, sessionsUsed: 0 })
    expect((await book({ scheduledAt: at('07:00'), type: 'regular' })).status).toBe(400)
  })
})
