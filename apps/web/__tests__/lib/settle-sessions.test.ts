import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer
let coachId: mongoose.Types.ObjectId
let clientId: mongoose.Types.ObjectId

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  coachId = new mongoose.Types.ObjectId()
  clientId = new mongoose.Types.ObjectId()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

beforeEach(async () => {
  const { Session, Balance } = await import('@atleti/db')
  await Session.deleteMany({})
  await Balance.deleteMany({})
})

describe('settlePastSessions', () => {
  it('marks past scheduled session as completed and increments balance', async () => {
    const { Session, Balance } = await import('@atleti/db')
    const { settlePastSessions } = await import('../../lib/settle-sessions')
    const s = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })
    await Balance.create({ clientId, coachId, sessionsTotal: 5, sessionsUsed: 0 })

    await settlePastSessions({ coachId })

    const after = await Session.findById(s._id)
    const bal = await Balance.findOne({ clientId, coachId })
    expect(after?.status).toBe('completed')
    expect(bal?.sessionsUsed).toBe(1)
  })

  it('is idempotent — running twice does not double-count', async () => {
    const { Session, Balance } = await import('@atleti/db')
    const { settlePastSessions } = await import('../../lib/settle-sessions')
    await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })
    await Balance.create({ clientId, coachId, sessionsTotal: 5, sessionsUsed: 0 })

    await settlePastSessions({ coachId })
    await settlePastSessions({ coachId })

    const bal = await Balance.findOne({ clientId, coachId })
    expect(bal?.sessionsUsed).toBe(1)
  })

  it('leaves future scheduled sessions untouched', async () => {
    const { Session } = await import('@atleti/db')
    const { settlePastSessions } = await import('../../lib/settle-sessions')
    const s = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'scheduled', createdBy: 'coach',
    })

    await settlePastSessions({ coachId })

    const after = await Session.findById(s._id)
    expect(after?.status).toBe('scheduled')
  })

  it('does not touch already cancelled past sessions', async () => {
    const { Session } = await import('@atleti/db')
    const { settlePastSessions } = await import('../../lib/settle-sessions')
    const s = await Session.create({
      clientId, coachId, scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
      duration: 60, type: 'regular', status: 'cancelled', createdBy: 'coach',
    })

    await settlePastSessions({ coachId })

    const after = await Session.findById(s._id)
    expect(after?.status).toBe('cancelled')
  })
})
