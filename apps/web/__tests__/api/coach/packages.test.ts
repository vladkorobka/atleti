// apps/web/__tests__/api/coach/packages.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachProfile } = await import('@atleti/db')
  await User.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  coachId = coach._id.toString()
  await CoachProfile.create({ userId: coachId, packages: [], plan: 'free', clientLimit: 10 })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { CoachProfile } = await import('@atleti/db')
  await CoachProfile.updateOne({ userId: coachId }, { packages: [] })
  vi.mock('@/lib/auth', () => ({
    auth: vi.fn().mockResolvedValue({
      user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
    })
  }))
})

describe('GET /api/coach/packages', () => {
  it('returns packages list', async () => {
    const { CoachProfile } = await import('@atleti/db')
    await CoachProfile.updateOne({ userId: coachId }, {
      packages: [{ name: 'Разове', sessions: 1, price: 900, currency: 'UAH' }]
    })
    const { GET } = await import('@/app/api/coach/packages/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.packages).toHaveLength(1)
    expect(data.packages[0].name).toBe('Разове')
  })
})

describe('POST /api/coach/packages', () => {
  it('adds a new package', async () => {
    const { POST } = await import('@/app/api/coach/packages/route')
    const req = new Request('http://localhost/api/coach/packages', {
      method: 'POST',
      body: JSON.stringify({ name: '8 тренувань', sessions: 8, price: 5600, currency: 'UAH' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.packages.some((p: any) => p.name === '8 тренувань')).toBe(true)
  })
})
