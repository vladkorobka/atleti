import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))

const sha256 = (t: string) => crypto.createHash('sha256').update(t).digest('hex')

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User } = await import('@atleti/db')
  await User.ensureIndexes()
})
afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })
beforeEach(async () => {
  const { User, PendingUser } = await import('@atleti/db')
  await User.deleteMany({})
  await PendingUser.deleteMany({})
})

async function post(body: unknown) {
  const { POST } = await import('@/app/api/auth/verify-email/route')
  const req = new Request('http://localhost/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
  return POST(req as any)
}

async function makePending(token: string, over: Record<string, unknown> = {}) {
  const { PendingUser } = await import('@atleti/db')
  return PendingUser.create({
    email: 'v@test.com', name: 'V', role: 'client', nickname: 'vuser',
    passwordHash: 'hashed', tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + 3600_000),
    ...over,
  })
}

describe('POST /api/auth/verify-email', () => {
  it('creates the account from a pending registration and removes the pending record', async () => {
    await makePending('valid-token')
    const res = await post({ token: 'valid-token' })
    expect(res.status).toBe(200)

    const { User, PendingUser } = await import('@atleti/db')
    const user = await User.findOne({ email: 'v@test.com' })
    expect(user?.nickname).toBe('vuser')
    expect((user as any)?.passwordHash).toBe('hashed')
    expect((user as any)?.emailVerified).toBe(true)
    expect(await PendingUser.findOne({ email: 'v@test.com' })).toBeNull()
  })

  it('rejects an invalid token (no account created)', async () => {
    await makePending('real')
    const res = await post({ token: 'wrong' })
    expect(res.status).toBe(400)
    const { User } = await import('@atleti/db')
    expect(await User.findOne({ email: 'v@test.com' })).toBeNull()
  })

  it('rejects an expired token', async () => {
    await makePending('expired', { expiresAt: new Date(Date.now() - 1000) })
    const res = await post({ token: 'expired' })
    expect(res.status).toBe(400)
  })

  it('returns 409 if email/nickname got taken meanwhile', async () => {
    const { User } = await import('@atleti/db')
    await User.create({ email: 'v@test.com', name: 'V', role: 'client', nickname: 'vuser', passwordHash: 'x' })
    await makePending('tok')
    const res = await post({ token: 'tok' })
    expect(res.status).toBe(409)
  })

  it('returns 400 for empty token', async () => {
    const res = await post({ token: '' })
    expect(res.status).toBe(400)
  })
})
