import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User } = await import('@atleti/db')
  await User.ensureIndexes()
  const coach = await User.create({ email: 'coach@b.test', name: 'Coach', role: 'coach', nickname: 'bcoach' })
  const client = await User.create({ email: 'client@b.test', name: 'Client', role: 'client', nickname: 'bclient' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
})

afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })

beforeEach(async () => {
  const { ClientCoach, Balance } = await import('@atleti/db')
  await ClientCoach.deleteMany({})
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'client@b.test', userId: clientId, role: 'client', nickname: 'bclient', name: 'Client' }
  } as any)
})

describe('GET /api/client/balance', () => {
  it('returns null balance when no active coach', async () => {
    const { GET } = await import('@/app/api/client/balance/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance).toBeNull()
    expect(data.message).toBe('No active coach')
  })

  it('returns zero balance when active coach but no balance record', async () => {
    const { ClientCoach } = await import('@atleti/db')
    await ClientCoach.create({ clientId, coachId, status: 'active' })
    const { GET } = await import('@/app/api/client/balance/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(0)
    expect(data.balance.sessionsRemaining).toBe(0)
  })

  it('returns balance with sessionsRemaining calculated', async () => {
    const { ClientCoach, Balance } = await import('@atleti/db')
    await ClientCoach.create({ clientId, coachId, status: 'active' })
    await Balance.create({ clientId, coachId, sessionsTotal: 10, sessionsUsed: 4, transactions: [] })
    const { GET } = await import('@/app/api/client/balance/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.balance.sessionsTotal).toBe(10)
    expect(data.balance.sessionsUsed).toBe(4)
    expect(data.balance.sessionsRemaining).toBe(6)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce(null as any)
    const { GET } = await import('@/app/api/client/balance/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
