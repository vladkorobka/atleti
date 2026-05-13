import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { User } from '../../models/index'

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  await User.ensureIndexes()
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

describe('User schema', () => {
  it('creates a user with required fields', async () => {
    const user = await User.create({
      email: 'coach@test.com',
      name: 'Test Coach',
      role: 'coach',
      nickname: 'testcoach',
    })
    expect(user.nickname).toBe('testcoach')
    expect(user.role).toBe('coach')
  })

  it('rejects duplicate nickname', async () => {
    await User.create({ email: 'a@test.com', name: 'A', role: 'client', nickname: 'dup' })
    await expect(
      User.create({ email: 'b@test.com', name: 'B', role: 'client', nickname: 'dup' })
    ).rejects.toThrow()
  })

  it('rejects duplicate email', async () => {
    await User.create({ email: 'same@test.com', name: 'A', role: 'coach', nickname: 'nick1' })
    await expect(
      User.create({ email: 'same@test.com', name: 'B', role: 'client', nickname: 'nick2' })
    ).rejects.toThrow()
  })
})
