import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { z } from 'zod'
import { ensureDB } from '@/lib/db'
import { User, PendingUser } from '@atleti/db'

const schema = z.object({ token: z.string().min(1) })

// Підтвердження email = фактичне створення акаунта з тимчасового запису PendingUser.
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Невалідний токен' }, { status: 400 })
  }

  await ensureDB()

  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex')
  const pending = await PendingUser.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
  if (!pending) {
    return NextResponse.json({ error: 'Посилання недійсне або застаріле' }, { status: 400 })
  }

  // Перевіряємо, що email/нікнейм досі вільні (могли зайняти, поки лист чекав)
  const clash = await User.findOne({ $or: [{ email: pending.email }, { nickname: pending.nickname }] })
  if (clash) {
    await PendingUser.deleteOne({ _id: pending._id })
    return NextResponse.json({ error: 'Email або нікнейм уже зайнято' }, { status: 409 })
  }

  await User.create({
    email: pending.email,
    name: pending.name,
    role: pending.role,
    nickname: pending.nickname,
    passwordHash: (pending as unknown as { passwordHash: string }).passwordHash,
    emailVerified: true,
  })
  await PendingUser.deleteOne({ _id: pending._id })

  return NextResponse.json({ ok: true })
}
