import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null)
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, Session } = await import('@atleti/db')
  await User.ensureIndexes()
  await Session.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { Session } = await import('@atleti/db')
  await Session.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
  } as any)
})

describe('POST /api/coach/sessions', () => {
  it('creates a session', async () => {
    const { POST } = await import('@/app/api/coach/sessions/route')
    const { ClientCoach } = await import('@atleti/db')
    await ClientCoach.deleteMany({})
    await ClientCoach.create({ clientId, coachId, status: 'active' })
    const scheduledAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const req = new Request('http://localhost/api/coach/sessions', {
      method: 'POST',
      body: JSON.stringify({ clientId, scheduledAt, duration: 60, type: 'regular' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.session.status).toBe('scheduled')
    expect(data.session.createdBy).toBe('coach')
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
    await Balance.deleteMany({})
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
    await Balance.deleteMany({})
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
    await Balance.deleteMany({})
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
