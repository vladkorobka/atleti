import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string
let clientId: string
let otherClientId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, ClientCoach } = await import('@atleti/db')
  await User.ensureIndexes()
  const coach = await User.create({ email: 'coach@test.com', name: 'Coach', role: 'coach', nickname: 'coach1' })
  const client = await User.create({ email: 'client@test.com', name: 'Client', role: 'client', nickname: 'client1' })
  const other = await User.create({ email: 'other@test.com', name: 'Other', role: 'client', nickname: 'other1' })
  coachId = coach._id.toString()
  clientId = client._id.toString()
  otherClientId = other._id.toString()
  await ClientCoach.create({ clientId, coachId, status: 'active' })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'coach@test.com', userId: coachId, role: 'coach', nickname: 'coach1', name: 'Coach' }
  } as any)
})

describe('PATCH /api/coach/clients/[clientId] — anamnesis', () => {
  it('saves anamnesis on the relationship', async () => {
    const { PATCH } = await import('@/app/api/coach/clients/[clientId]/route')
    const { ClientCoach } = await import('@atleti/db')
    const req = new Request(`http://localhost/api/coach/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ anamnesis: 'Травма коліна 2025, ціль — набір маси' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req as any, { params: { clientId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.anamnesis).toBe('Травма коліна 2025, ціль — набір маси')
    const rel = await ClientCoach.findOne({ clientId, coachId })
    expect(rel!.anamnesis).toBe('Травма коліна 2025, ціль — набір маси')
  })

  it('returns 401 when not a coach', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce(null as any)
    const { PATCH } = await import('@/app/api/coach/clients/[clientId]/route')
    const req = new Request(`http://localhost/api/coach/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ anamnesis: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req as any, { params: { clientId } })
    expect(res.status).toBe(401)
  })

  it('returns 404 for a client not linked to this coach', async () => {
    const { PATCH } = await import('@/app/api/coach/clients/[clientId]/route')
    const req = new Request(`http://localhost/api/coach/clients/${otherClientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ anamnesis: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req as any, { params: { clientId: otherClientId } })
    expect(res.status).toBe(404)
  })

  it('rejects anamnesis over 5000 chars', async () => {
    const { PATCH } = await import('@/app/api/coach/clients/[clientId]/route')
    const req = new Request(`http://localhost/api/coach/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ anamnesis: 'a'.repeat(5001) }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req as any, { params: { clientId } })
    expect(res.status).toBe(400)
  })
})
