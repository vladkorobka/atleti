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
  const { User, ClientCoach } = await import('@atleti/db')
  await User.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
  await ClientCoach.create({ clientId, coachId, status: 'active' })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { Balance } = await import('@atleti/db')
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
  } as any)
})

describe('POST /api/coach/clients/[clientId]/balance', () => {
  it('tops up balance with sessions', async () => {
    const { POST } = await import('@/app/api/coach/clients/[clientId]/balance/route')
    const req = new Request(`http://localhost/api/coach/clients/${clientId}/balance`, {
      method: 'POST',
      body: JSON.stringify({ sessions: 8, note: '8 тренувань' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any, { params: { clientId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(8)
    expect(data.balance.sessionsRemaining).toBe(8)
    expect(data.balance.transactions).toHaveLength(1)
    expect(data.balance.transactions[0].type).toBe('topup')
  })

  it('accumulates multiple top-ups', async () => {
    const { POST } = await import('@/app/api/coach/clients/[clientId]/balance/route')
    const makeReq = (sessions: number) => new Request(`http://localhost/api/coach/clients/${clientId}/balance`, {
      method: 'POST',
      body: JSON.stringify({ sessions, note: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(makeReq(6) as any, { params: { clientId } })
    const res = await POST(makeReq(8) as any, { params: { clientId } })
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(14)
    expect(data.balance.transactions).toHaveLength(2)
  })
})

describe('GET /api/coach/clients/[clientId]/balance', () => {
  it('returns balance with sessionsRemaining', async () => {
    const { Balance } = await import('@atleti/db')
    await Balance.create({
      clientId, coachId, sessionsTotal: 8, sessionsUsed: 3,
      transactions: [{ type: 'topup', sessions: 8, note: 'initial', createdAt: new Date(), recordedBy: coachId }]
    })
    const { GET } = await import('@/app/api/coach/clients/[clientId]/balance/route')
    const req = new Request(`http://localhost/api/coach/clients/${clientId}/balance`)
    const res = await GET(req as any, { params: { clientId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(8)
    expect(data.balance.sessionsRemaining).toBe(5)
  })
})
