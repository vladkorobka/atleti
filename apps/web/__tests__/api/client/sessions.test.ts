import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string
let otherClientId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, Session, CoachProfile } = await import('@atleti/db')
  await User.ensureIndexes()
  await Session.ensureIndexes()
  const coach = await User.create({ email: 'coach@s.test', name: 'Coach', role: 'coach', nickname: 'scoach' })
  const client = await User.create({ email: 'client@s.test', name: 'Client', role: 'client', nickname: 'sclient' })
  const otherClient = await User.create({ email: 'other@s.test', name: 'Other', role: 'client', nickname: 'sother' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
  otherClientId = otherClient._id.toString()
  // Create coach profile with 24h cancellation deadline
  await CoachProfile.create({ userId: coachId, cancellationDeadlineHours: 24 })
})

afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })

beforeEach(async () => {
  const { Session, ClientCoach, Balance } = await import('@atleti/db')
  await Session.deleteMany({})
  await ClientCoach.deleteMany({})
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'client@s.test', userId: clientId, role: 'client', nickname: 'sclient', name: 'Client' }
  } as any)
})

describe('GET /api/client/sessions', () => {
  it('returns empty array when no sessions', async () => {
    const { GET } = await import('@/app/api/client/sessions/route')
    const req = new Request('http://localhost/api/client/sessions')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sessions).toEqual([])
  })

  it("returns only the client's sessions, not other clients'", async () => {
    const { Session } = await import('@atleti/db')
    await Session.create({
      clientId, coachId,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })
    // Session for another client — should NOT appear
    await Session.create({
      clientId: otherClientId, coachId,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })

    const { GET } = await import('@/app/api/client/sessions/route')
    const req = new Request('http://localhost/api/client/sessions')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].clientId.toString()).toBe(clientId)
  })

  it('filters sessions by ?status=scheduled', async () => {
    const { Session } = await import('@atleti/db')
    await Session.create({
      clientId, coachId,
      scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })
    await Session.create({
      clientId, coachId,
      scheduledAt: new Date(Date.now() + 96 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'cancelled', createdBy: 'coach',
    })

    const { GET } = await import('@/app/api/client/sessions/route')
    const req = new Request('http://localhost/api/client/sessions?status=scheduled')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sessions).toHaveLength(1)
    expect(data.sessions[0].status).toBe('scheduled')
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce(null as any)
    const { GET } = await import('@/app/api/client/sessions/route')
    const req = new Request('http://localhost/api/client/sessions')
    const res = await GET(req as any)
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/client/sessions/[sessionId]', () => {
  it('cancels a session within deadline; balance unchanged (debit happens on completion)', async () => {
    const { Session, ClientCoach, Balance } = await import('@atleti/db')
    const session = await Session.create({
      clientId, coachId,
      scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days out
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })
    await ClientCoach.create({ clientId, coachId, status: 'active' })
    await Balance.create({ clientId, coachId, sessionsTotal: 5, sessionsUsed: 3, transactions: [] })

    const { PUT } = await import('@/app/api/client/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/client/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({ cancelReason: 'Не можу прийти' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.session.status).toBe('cancelled')
    expect(data.session.cancelledByRole).toBe('client')
    expect(data.session.cancelReason).toBe('Не можу прийти')

    // Заплановане заняття не списувало баланс (резерв), тож скасування його не змінює
    const updatedBalance = await Balance.findOne({ clientId, coachId })
    expect(updatedBalance!.sessionsUsed).toBe(3)
    expect(updatedBalance!.transactions.length).toBe(0)
  })

  it('returns 403 when past cancellation deadline', async () => {
    const { Session, ClientCoach } = await import('@atleti/db')
    // Session scheduled in 1 second — less than 24h deadline
    const session = await Session.create({
      clientId, coachId,
      scheduledAt: new Date(Date.now() + 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })
    await ClientCoach.create({ clientId, coachId, status: 'active' })

    const { PUT } = await import('@/app/api/client/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/client/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('Cancellation deadline passed')
  })

  it('returns 404 when session belongs to another client', async () => {
    const { Session, ClientCoach } = await import('@atleti/db')
    const session = await Session.create({
      clientId: otherClientId, coachId,
      scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })
    await ClientCoach.create({ clientId, coachId, status: 'active' })

    const { PUT } = await import('@/app/api/client/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/client/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(404)
  })

  it('returns 404 when session is already cancelled', async () => {
    const { Session, ClientCoach } = await import('@atleti/db')
    const session = await Session.create({
      clientId, coachId,
      scheduledAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'cancelled', createdBy: 'coach',
    })
    await ClientCoach.create({ clientId, coachId, status: 'active' })

    const { PUT } = await import('@/app/api/client/sessions/[sessionId]/route')
    const req = new Request(`http://localhost/api/client/sessions/${session._id}`, {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: session._id.toString() } })
    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce(null as any)
    const { PUT } = await import('@/app/api/client/sessions/[sessionId]/route')
    const req = new Request('http://localhost/api/client/sessions/fakeid', {
      method: 'PUT',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any, { params: { sessionId: 'fakeid' } })
    expect(res.status).toBe(401)
  })
})
