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
  const coach = await User.create({ email: 'coach@c.test', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@c.test', name: 'Client', role: 'client', nickname: 'client1' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
})

afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })

beforeEach(async () => {
  const { ClientCoach, Balance } = await import('@atleti/db')
  await ClientCoach.deleteMany({})
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'client@c.test', userId: clientId, role: 'client', nickname: 'client1', name: 'Client' }
  } as any)
})

describe('GET /api/client/status', () => {
  it('returns none when no relationship', async () => {
    const { GET } = await import('@/app/api/client/status/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('none')
    expect(data.coach).toBeNull()
  })

  it('returns pending status', async () => {
    const { ClientCoach } = await import('@atleti/db')
    await ClientCoach.create({ clientId, coachId, status: 'pending' })
    const { GET } = await import('@/app/api/client/status/route')
    const res = await GET()
    const data = await res.json()
    expect(data.status).toBe('pending')
    expect(data.coach.name).toBe('Coach')
  })

  it('returns active status with balance', async () => {
    const { ClientCoach, Balance } = await import('@atleti/db')
    await ClientCoach.create({ clientId, coachId, status: 'active' })
    await Balance.create({ clientId, coachId, sessionsTotal: 8, sessionsUsed: 3, transactions: [] })
    const { GET } = await import('@/app/api/client/status/route')
    const res = await GET()
    const data = await res.json()
    expect(data.status).toBe('active')
    expect(data.balance.sessionsRemaining).toBe(5)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce(null)
    const { GET } = await import('@/app/api/client/status/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns 401 when user is not a client', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce({
      user: { email: 'coach@c.test', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
    } as any)
    const { GET } = await import('@/app/api/client/status/route')
    const res = await GET()
    expect(res.status).toBe(401)
  })
})
