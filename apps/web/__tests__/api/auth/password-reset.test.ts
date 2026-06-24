import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
// не шлемо реальних листів
vi.mock('@/lib/email', () => ({ sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined) }))

const sha256 = (t: string) => crypto.createHash('sha256').update(t).digest('hex')

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
  const { User } = await import('@atleti/db')
  await User.deleteMany({})
})

async function forgot(body: unknown) {
  const { POST } = await import('@/app/api/auth/forgot-password/route')
  const req = new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  })
  return POST(req as any)
}

async function reset(body: unknown) {
  const { POST } = await import('@/app/api/auth/reset-password/route')
  const req = new Request('http://localhost/api/auth/reset-password', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  })
  return POST(req as any)
}

describe('POST /api/auth/forgot-password', () => {
  it('generates a reset token for an existing user', async () => {
    const { User } = await import('@atleti/db')
    await User.create({ email: 'a@test.com', name: 'A', role: 'client', nickname: 'a1', passwordHash: 'x' })

    const res = await forgot({ email: 'a@test.com' })
    expect(res.status).toBe(200)
    const u = await User.findOne({ email: 'a@test.com' })
    expect((u as any).resetTokenHash).toBeTruthy()
    expect((u as any).resetTokenExpiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns 200 without leaking for unknown email', async () => {
    const res = await forgot({ email: 'nobody@test.com' })
    expect(res.status).toBe(200)
  })

  it('rejects invalid email → 400', async () => {
    expect((await forgot({ email: 'not-an-email' })).status).toBe(400)
  })
})

describe('POST /api/auth/reset-password', () => {
  it('sets a new password with a valid token and clears it', async () => {
    const { User } = await import('@atleti/db')
    const token = 'rawtoken123'
    await User.create({
      email: 'b@test.com', name: 'B', role: 'client', nickname: 'b1', passwordHash: 'old',
      resetTokenHash: sha256(token), resetTokenExpiresAt: new Date(Date.now() + 3600_000),
    })

    const res = await reset({ token, password: 'newpass123' })
    expect(res.status).toBe(200)

    const u = await User.findOne({ email: 'b@test.com' }).select('+passwordHash')
    expect(await bcrypt.compare('newpass123', (u as any).passwordHash)).toBe(true)
    expect((u as any).resetTokenHash).toBeFalsy()
  })

  it('rejects an expired token → 400', async () => {
    const { User } = await import('@atleti/db')
    const token = 'expiredtok'
    await User.create({
      email: 'c@test.com', name: 'C', role: 'client', nickname: 'c1', passwordHash: 'old',
      resetTokenHash: sha256(token), resetTokenExpiresAt: new Date(Date.now() - 1000),
    })
    expect((await reset({ token, password: 'newpass123' })).status).toBe(400)
  })

  it('rejects an invalid token → 400', async () => {
    expect((await reset({ token: 'whatever', password: 'newpass123' })).status).toBe(400)
  })

  it('rejects a too-short password → 400', async () => {
    const { User } = await import('@atleti/db')
    const token = 'shorttok'
    await User.create({
      email: 'd@test.com', name: 'D', role: 'client', nickname: 'd1', passwordHash: 'old',
      resetTokenHash: sha256(token), resetTokenExpiresAt: new Date(Date.now() + 3600_000),
    })
    expect((await reset({ token, password: 'short' })).status).toBe(400)
  })
})
