import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer

vi.mock('@/lib/db', () => ({
  ensureDB: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/email', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User } = await import('@atleti/db')
  await User.ensureIndexes()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { User, PendingUser } = await import('@atleti/db')
  await User.deleteMany({})
  await PendingUser.deleteMany({})
})

describe('POST /api/auth/register', () => {
  it('does NOT create an account, creates a pending registration + sends email', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'coach@test.com', password: 'password123', name: 'Test Coach', role: 'coach', nickname: 'testcoach' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)

    const { User, PendingUser } = await import('@atleti/db')
    // акаунт ще НЕ створено
    expect(await User.findOne({ email: 'coach@test.com' })).toBeNull()
    // створено тимчасовий запис із хешованим паролем + токеном
    const pending = await PendingUser.findOne({ email: 'coach@test.com' })
    expect(pending?.nickname).toBe('testcoach')
    expect((pending as any)?.passwordHash).toBeDefined()
    expect((pending as any)?.passwordHash).not.toBe('password123')
    expect((pending as any)?.tokenHash).toBeDefined()

    const { sendVerificationEmail } = await import('@/lib/email')
    expect(sendVerificationEmail).toHaveBeenCalledWith('coach@test.com', expect.stringContaining('/verify-email?token='))
  })

  it('rejects an invalid nickname format', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'x@test.com', password: 'password123', name: 'X', role: 'client', nickname: 'bad nick!' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects duplicate nickname', async () => {
    const { User } = await import('@atleti/db')
    await User.create({ email: 'a@test.com', name: 'A', role: 'coach', nickname: 'taken', passwordHash: 'x' })
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'b@test.com', password: 'password123', name: 'B', role: 'client', nickname: 'taken' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('Нікнейм')
  })

  it('rejects missing fields', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'a@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })
})
