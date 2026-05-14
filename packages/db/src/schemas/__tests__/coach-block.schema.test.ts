import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { CoachBlock, User } from '../../models/index'

let mongod: MongoMemoryServer
let coachId: string

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await CoachBlock.ensureIndexes()
  const user = await User.create({ email: 'cb@test.com', name: 'Coach', role: 'coach', nickname: 'coachblock' })
  coachId = user._id.toString()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('CoachBlock schema', () => {
  it('creates a one-time time block', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'time',
      date: '2026-05-14',
      startTime: '12:00',
      endTime: '13:00',
      label: 'Обід',
    })
    expect(block.type).toBe('time')
    expect(block.startTime).toBe('12:00')
    expect(block.label).toBe('Обід')
  })

  it('creates a vacation block', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'vacation',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-14',
    })
    expect(block.type).toBe('vacation')
    expect(block.dateFrom).toBe('2026-07-01')
  })

  it('creates a recurring daily time block (no date)', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'time',
      startTime: '12:00',
      endTime: '13:00',
      recurring: { type: 'daily' },
    })
    expect(block.recurring?.type).toBe('daily')
    expect(block.date).toBeUndefined()
  })

  it('creates a recurring weekly day block', async () => {
    const block = await CoachBlock.create({
      coachId,
      type: 'day',
      recurring: { type: 'weekly', dayOfWeek: 'sun', until: '2026-12-31' },
    })
    expect(block.recurring?.dayOfWeek).toBe('sun')
    expect(block.recurring?.until).toBe('2026-12-31')
  })

  it('requires coachId', async () => {
    await expect(
      CoachBlock.create({ type: 'day', date: '2026-05-14' })
    ).rejects.toThrow()
  })
})
