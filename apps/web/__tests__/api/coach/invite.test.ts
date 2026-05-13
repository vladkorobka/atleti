import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null)
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachProfile, ClientCoach } = await import('@atleti/db')
  await User.ensureIndexes()
  await ClientCoach.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  coachId = coach._id.toString()
  await CoachProfile.create({ userId: coachId, plan: 'free', clientLimit: 10 })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { ClientCoach, User } = await import('@atleti/db')
  await ClientCoach.deleteMany({})
  await User.deleteMany({ email: { $ne: 'coach@test.com' } })
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
  } as any)
})

describe('POST /api/coach/clients/invite', () => {
  it('creates pending invite for existing client', async () => {
    const { User } = await import('@atleti/db')
    await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })

    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'client1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.invite.status).toBe('pending')
  })

  it('rejects invite for non-existent nickname', async () => {
    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'nobody' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(404)
  })

  it('rejects invite for client who already has active coach', async () => {
    const { User, ClientCoach } = await import('@atleti/db')
    const client = await User.create({ email: 'busy@test.com', name: 'Busy', role: 'client', nickname: 'busyclient' })
    const otherCoach = await User.create({ email: 'other@test.com', name: 'Other', role: 'coach', nickname: 'othercoach' })
    await ClientCoach.create({ clientId: client._id, coachId: otherCoach._id, status: 'active' })

    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'busyclient' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('вже має тренера')
  })

  it('blocks invite when coach at free plan limit', async () => {
    const { User, ClientCoach, CoachProfile } = await import('@atleti/db')
    await CoachProfile.updateOne({ userId: coachId }, { clientLimit: 1 })
    const existingClient = await User.create({ email: 'existing@test.com', name: 'Ex', role: 'client', nickname: 'existing1' })
    await ClientCoach.create({ clientId: existingClient._id, coachId, status: 'active' })
    await User.create({ email: 'new@test.com', name: 'New', role: 'client', nickname: 'newclient1' })

    const { POST } = await import('@/app/api/coach/clients/invite/route')
    const req = new Request('http://localhost/api/coach/clients/invite', {
      method: 'POST',
      body: JSON.stringify({ nickname: 'newclient1' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('ліміт')

    await CoachProfile.updateOne({ userId: coachId }, { clientLimit: 10 })
  })
})
