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
  const coach = await User.create({ email: 'coach@l.test', name: 'Coach', role: 'coach', nickname: 'lcoach' })
  const client = await User.create({ email: 'client@l.test', name: 'Client', role: 'client', nickname: 'lclient' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
})

afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })

beforeEach(async () => {
  const { ClientCoach, Balance } = await import('@atleti/db')
  await ClientCoach.deleteMany({})
  await Balance.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'client@l.test', userId: clientId, role: 'client', nickname: 'lclient', name: 'Client' }
  } as any)
})

describe('DELETE /api/client/coach', () => {
  it('terminates active relationship and resets balance', async () => {
    const { ClientCoach, Balance } = await import('@atleti/db')
    await ClientCoach.create({ clientId, coachId, status: 'active' })
    await Balance.create({ clientId, coachId, sessionsTotal: 8, sessionsUsed: 2, transactions: [] })

    const { DELETE } = await import('@/app/api/client/coach/route')
    const res = await DELETE()
    expect(res.status).toBe(200)

    const rel = await ClientCoach.findOne({ clientId, coachId })
    expect(rel?.status).toBe('terminated')

    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsTotal).toBe(0)
    expect(bal?.sessionsUsed).toBe(0)
  })

  it('terminates pending relationship', async () => {
    const { ClientCoach } = await import('@atleti/db')
    await ClientCoach.create({ clientId, coachId, status: 'pending' })

    const { DELETE } = await import('@/app/api/client/coach/route')
    const res = await DELETE()
    expect(res.status).toBe(200)

    const rel = await ClientCoach.findOne({ clientId, coachId })
    expect(rel?.status).toBe('terminated')
  })

  it('returns 404 when no active relationship', async () => {
    const { DELETE } = await import('@/app/api/client/coach/route')
    const res = await DELETE()
    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce(null as any)
    const { DELETE } = await import('@/app/api/client/coach/route')
    const res = await DELETE()
    expect(res.status).toBe(401)
  })
})
