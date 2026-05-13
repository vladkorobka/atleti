import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { email: 'coach@test.com', userId: new mongoose.Types.ObjectId().toString(), role: 'coach', nickname: 'coach1', name: 'Coach' }
  })
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachProfile } = await import('@atleti/db')
  await User.ensureIndexes()
  await CoachProfile.ensureIndexes()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { User, CoachProfile } = await import('@atleti/db')
  await User.deleteMany({})
  await CoachProfile.deleteMany({})
})

describe('GET /api/coach/profile', () => {
  it('returns null profile if not created yet', async () => {
    const { User } = await import('@atleti/db')
    const user = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce({
      user: { email: 'coach@test.com', userId: user._id.toString(), role: 'coach', nickname: 'coach1', name: 'Coach' }
    } as any)

    const { GET } = await import('@/app/api/coach/profile/route')
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile).toBeNull()
  })
})

describe('PUT /api/coach/profile', () => {
  it('creates coach profile', async () => {
    const { User } = await import('@atleti/db')
    const user = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce({
      user: { email: 'coach@test.com', userId: user._id.toString(), role: 'coach', nickname: 'coach1', name: 'Coach' }
    } as any)

    const { PUT } = await import('@/app/api/coach/profile/route')
    const req = new Request('http://localhost/api/coach/profile', {
      method: 'PUT',
      body: JSON.stringify({ bio: 'Тренер з 10 роками досвіду', specializations: ['fitness', 'rehab'], cancellationDeadlineHours: 24 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PUT(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.profile.bio).toBe('Тренер з 10 роками досвіду')
    expect(data.profile.cancellationDeadlineHours).toBe(24)
  })
})
