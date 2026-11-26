import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import bcrypt from 'bcryptjs'
import { kyivWallTimeToUtc } from '@/lib/tz'

const sent: { chatId: number; text: string }[] = []
vi.mock('@/lib/telegram/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/telegram/api')>()),
  sendMessage: vi.fn(async (chatId: number, text: string) => { sent.push({ chatId, text }); return true }),
  deleteMessage: vi.fn(async () => true),
}))

let mongod: MongoMemoryServer
let db: typeof import('@atleti/db')
let jobs: typeof import('@/lib/telegram/jobs')
let bot: typeof import('@/lib/telegram/bot')
let coachId: unknown, clientId: unknown

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
  db = await import('@atleti/db')
  jobs = await import('@/lib/telegram/jobs')
  bot = await import('@/lib/telegram/bot')
  await Promise.all([db.User.ensureIndexes(), db.TelegramChat.ensureIndexes(), db.TelegramSent.ensureIndexes(), db.TelegramLoginFail.ensureIndexes()])
  const passwordHash = await bcrypt.hash('secret123', 4)
  coachId = (await db.User.create({ email: 'c@t.com', name: 'Coach', role: 'coach', nickname: 'coach1', passwordHash } as any))._id
  clientId = (await db.User.create({ email: 'k@t.com', name: 'Олег <b>', role: 'client', nickname: 'client1', passwordHash } as any))._id
  await db.CoachProfile.create({ userId: coachId, cancellationDeadlineHours: 24 } as any)
})
afterAll(async () => { await mongoose.disconnect(); await mongod.stop() })
beforeEach(async () => {
  sent.length = 0
  await Promise.all([db.TelegramChat.deleteMany({}), db.TelegramSent.deleteMany({}), db.TelegramLoginFail.deleteMany({}), db.Session.deleteMany({})])
})

const msg = (chatId: number, text: string, id = 1) =>
  ({ update_id: id, message: { message_id: id, chat: { id: chatId, type: 'private' }, text } })

async function link(chatId: number, nick: string) {
  await bot.handleUpdate(msg(chatId, '/start'))
  await bot.handleUpdate(msg(chatId, nick))
  await bot.handleUpdate(msg(chatId, 'secret123'))
}

describe('прив\'язка', () => {
  it('нікнейм + правильний пароль прив\'язує чат', async () => {
    await link(100, '@Coach1')
    const chat = await db.TelegramChat.findOne({ chatId: 100 }).lean()
    expect(String(chat!.userId)).toBe(String(coachId))
  })
  it('невірний пароль не прив\'язує, нікнейм без пароля — теж', async () => {
    await bot.handleUpdate(msg(101, 'coach1'))
    await bot.handleUpdate(msg(101, 'wrong'))
    expect((await db.TelegramChat.findOne({ chatId: 101 }).lean())!.userId).toBeUndefined()
  })
  it('після 5 невдач чат блокується навіть із правильним паролем', async () => {
    for (let i = 0; i < 5; i++) { await bot.handleUpdate(msg(102, 'coach1')); await bot.handleUpdate(msg(102, 'bad')) }
    await bot.handleUpdate(msg(102, 'coach1'))
    await bot.handleUpdate(msg(102, 'secret123'))
    expect((await db.TelegramChat.findOne({ chatId: 102 }).lean())!.userId).toBeUndefined()
  })
  it('10 невдач з різних чатів блокують акаунт і для нового чату', async () => {
    for (let i = 0; i < 10; i++) { await bot.handleUpdate(msg(500 + i, 'coach1')); await bot.handleUpdate(msg(500 + i, 'bad')) }
    await link(600, 'coach1')
    expect((await db.TelegramChat.findOne({ chatId: 600 }).lean())!.userId).toBeUndefined()
  })
  it('пароль, надісланий замість нікнейма, не зберігається в БД', async () => {
    await bot.handleUpdate(msg(105, 'secret123'))
    expect(JSON.stringify(await db.TelegramChat.findOne({ chatId: 105 }).lean())).not.toContain('secret123')
  })
  it('паралельні паролі після одного нікнейма — рівно одна спроба', async () => {
    const spy = vi.spyOn(bcrypt, 'compare')
    await bot.handleUpdate(msg(106, 'coach1'))
    spy.mockClear()
    await Promise.all(['a', 'b', 'c', 'd'].map((p, i) => bot.handleUpdate(msg(106, p, 10 + i))))
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('прив\'язка з нового чату знімає стару', async () => {
    await link(103, 'coach1')
    await link(104, 'coach1')
    expect((await db.TelegramChat.findOne({ chatId: 103 }).lean())!.userId).toBeUndefined()
  })
})

describe('розсилки', () => {
  beforeEach(async () => { await link(200, 'coach1'); await link(300, 'client1'); sent.length = 0 })

  it('дайджест о 07:00 — лише заняття тренера на сьогодні, рівно раз', async () => {
    await db.Session.create([
      { coachId, clientId, scheduledAt: kyivWallTimeToUtc(2026, 11, 26, 10, 0), createdBy: 'client' },
      { coachId, clientId, scheduledAt: kyivWallTimeToUtc(2026, 11, 27, 10, 0), createdBy: 'client' },
      { coachId, clientId, scheduledAt: kyivWallTimeToUtc(2026, 11, 26, 12, 0), createdBy: 'client', status: 'cancelled' },
    ] as any)
    const at7 = kyivWallTimeToUtc(2026, 11, 26, 7, 0)
    expect(await jobs.sendCoachDigests(at7)).toBe(1)
    expect(await jobs.sendCoachDigests(kyivWallTimeToUtc(2026, 11, 26, 7, 5))).toBe(0)
    expect(sent).toHaveLength(1)
    expect(sent[0].chatId).toBe(200)
    expect(sent[0].text).toContain('10:00')
    expect(sent[0].text).not.toContain('12:00')
    expect(sent[0].text).toContain('Олег &lt;b&gt;')
  })
  it('поза 07:xx дайджесту немає', async () => {
    expect(await jobs.sendCoachDigests(kyivWallTimeToUtc(2026, 11, 26, 9, 0))).toBe(0)
  })
  it('нагадування клієнту о 17:30 напередодні заняття о 18:00, рівно раз', async () => {
    await db.Session.create({ coachId, clientId, scheduledAt: kyivWallTimeToUtc(2026, 11, 27, 18, 0), createdBy: 'client' } as any)
    expect(await jobs.sendClientReminders(kyivWallTimeToUtc(2026, 11, 26, 17, 25))).toBe(0)
    expect(await jobs.sendClientReminders(kyivWallTimeToUtc(2026, 11, 26, 17, 30))).toBe(1)
    expect(await jobs.sendClientReminders(kyivWallTimeToUtc(2026, 11, 26, 17, 35))).toBe(0)
    expect(sent[0].chatId).toBe(300)
    expect(sent[0].text).toContain('18:00')
  })
  it('невдала відправка знімає ключ — наступний прогін повторює', async () => {
    const api = await import('@/lib/telegram/api')
    vi.mocked(api.sendMessage).mockResolvedValueOnce(false)
    await db.Session.create({ coachId, clientId, scheduledAt: kyivWallTimeToUtc(2026, 11, 27, 18, 0), createdBy: 'client' } as any)
    expect(await jobs.sendClientReminders(kyivWallTimeToUtc(2026, 11, 26, 17, 30))).toBe(0)
    expect(await jobs.sendClientReminders(kyivWallTimeToUtc(2026, 11, 26, 17, 50))).toBe(1)
    expect(sent.at(-1)!.text).toContain('лишилось 10 хв')
  })
  it('перенесене заняття отримує нове нагадування', async () => {
    const s = await db.Session.create({ coachId, clientId, scheduledAt: kyivWallTimeToUtc(2026, 11, 27, 18, 0), createdBy: 'client' } as any)
    await jobs.sendClientReminders(kyivWallTimeToUtc(2026, 11, 26, 17, 30))
    await db.Session.updateOne({ _id: s._id }, { scheduledAt: kyivWallTimeToUtc(2026, 11, 27, 19, 0) })
    expect(await jobs.sendClientReminders(kyivWallTimeToUtc(2026, 11, 26, 18, 30))).toBe(1)
  })
})
