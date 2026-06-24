import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: string

vi.mock('@/lib/db', () => ({ ensureDB: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  const { User, CoachBlock } = await import('@atleti/db')
  await User.ensureIndexes()
  await CoachBlock.ensureIndexes()
  const coach = await User.create({ email: 'blocks@test.com', name: 'Coach', role: 'coach', nickname: 'coachblocks' })
  coachId = coach._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { CoachBlock } = await import('@atleti/db')
  await CoachBlock.deleteMany({})
  vi.mocked((await import('@/lib/auth')).auth).mockResolvedValue({
    user: { email: 'blocks@test.com', userId: coachId, role: 'coach', nickname: 'coachblocks', name: 'Coach' }
  } as any)
})

describe('POST /api/coach/blocks', () => {
  it('creates a one-time time block', async () => {
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00', label: 'Обід' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.block.type).toBe('time')
    expect(data.block.startTime).toBe('12:00')
  })

  it('creates a vacation block', async () => {
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'vacation', dateFrom: '2026-07-01', dateTo: '2026-07-14' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.block.type).toBe('vacation')
  })

  it('rejects invalid block (missing startTime for time type)', async () => {
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'time', date: '2026-05-14' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 401 for non-coach', async () => {
    vi.mocked((await import('@/lib/auth')).auth).mockResolvedValueOnce({
      user: { userId: coachId, role: 'client', nickname: 'x', name: 'x', email: 'x@x.com' }
    } as any)
    const { POST } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks', {
      method: 'POST',
      body: JSON.stringify({ type: 'day', date: '2026-05-14' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })
})

describe('GET /api/coach/blocks', () => {
  it('returns blocks for the requested month', async () => {
    const { CoachBlock } = await import('@atleti/db')
    await CoachBlock.create({ coachId, type: 'day', date: '2026-05-14' })
    await CoachBlock.create({ coachId, type: 'day', date: '2026-06-01' })

    const { GET } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks?month=2026-05')
    const res = await GET(req as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.blocks.length).toBe(1)
    expect(data.blocks[0].date).toBe('2026-05-14')
  })

  it('always includes recurring blocks', async () => {
    const { CoachBlock } = await import('@atleti/db')
    await CoachBlock.create({ coachId, type: 'time', startTime: '12:00', endTime: '13:00', recurring: { type: 'daily' } })

    const { GET } = await import('@/app/api/coach/blocks/route')
    const req = new Request('http://localhost/api/coach/blocks?month=2026-05')
    const res = await GET(req as any)
    const data = await res.json()
    expect(data.blocks.some((b: any) => b.recurring?.type === 'daily')).toBe(true)
  })
})

describe('DELETE /api/coach/blocks/[blockId]', () => {
  it('deletes a block owned by the coach', async () => {
    const { CoachBlock } = await import('@atleti/db')
    const block = await CoachBlock.create({ coachId, type: 'day', date: '2026-05-14' })

    const { DELETE } = await import('@/app/api/coach/blocks/[blockId]/route')
    const req = new Request(`http://localhost/api/coach/blocks/${block._id}`)
    const res = await DELETE(req as any, { params: { blockId: block._id.toString() } })
    expect(res.status).toBe(200)

    const remaining = await CoachBlock.findById(block._id)
    expect(remaining).toBeNull()
  })

  it('returns 404 for non-existent block', async () => {
    const { DELETE } = await import('@/app/api/coach/blocks/[blockId]/route')
    const req = new Request('http://localhost/api/coach/blocks/000000000000000000000000')
    const res = await DELETE(req as any, { params: { blockId: '000000000000000000000000' } })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/coach/blocks/[blockId]', () => {
  async function patch(blockId: string, body: Record<string, unknown>) {
    const { PATCH } = await import('@/app/api/coach/blocks/[blockId]/route')
    const req = new Request(`http://localhost/api/coach/blocks/${blockId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
    return PATCH(req as any, { params: { blockId } })
  }

  it('edits a time block (updates fields)', async () => {
    const { CoachBlock } = await import('@atleti/db')
    const block = await CoachBlock.create({ coachId, type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00', label: 'Обід' })

    const res = await patch(block._id.toString(), { type: 'time', date: '2026-05-14', startTime: '14:00', endTime: '15:00', label: 'Перерва' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.block.startTime).toBe('14:00')
    expect(data.block.label).toBe('Перерва')
  })

  it('clears stale fields when switching type (time → day)', async () => {
    const { CoachBlock } = await import('@atleti/db')
    const block = await CoachBlock.create({ coachId, type: 'time', date: '2026-05-14', startTime: '12:00', endTime: '13:00' })

    const res = await patch(block._id.toString(), { type: 'day', date: '2026-05-14' })
    expect(res.status).toBe(200)
    const updated = await CoachBlock.findById(block._id)
    expect(updated?.type).toBe('day')
    expect(updated?.startTime).toBeUndefined()
    expect(updated?.endTime).toBeUndefined()
  })

  it('returns 404 for non-existent block', async () => {
    const res = await patch('000000000000000000000000', { type: 'day', date: '2026-05-14' })
    expect(res.status).toBe(404)
  })

  it('rejects invalid payload (time without start/end) → 400', async () => {
    const { CoachBlock } = await import('@atleti/db')
    const block = await CoachBlock.create({ coachId, type: 'day', date: '2026-05-14' })
    const res = await patch(block._id.toString(), { type: 'time', date: '2026-05-14' })
    expect(res.status).toBe(400)
  })
})
