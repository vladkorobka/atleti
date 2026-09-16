import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { ensureDB } from '@/lib/db'
import { User } from '@atleti/db'

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Пароль має містити щонайменше 8 символів'),
})

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.password?.[0] ?? 'Невалідні дані'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const { token, password } = parsed.data

  await ensureDB()
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const user = await User.findOne({
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: { $gt: new Date() },
  })
  if (!user) {
    return NextResponse.json({ error: 'Недійсне або прострочене посилання' }, { status: 400 })
  }

  user.set('passwordHash', await bcrypt.hash(password, 12))
  // одноразовість — токен анулюється після використання
  user.set('resetTokenHash', undefined)
  user.set('resetTokenExpiresAt', undefined)
  await user.save()

  return NextResponse.json({ ok: true })
}
