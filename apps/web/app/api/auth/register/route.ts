import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { ensureDB } from '@/lib/db'
import { User, PendingUser } from '@atleti/db'
import { sendVerificationEmail } from '@/lib/email'

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000 // 24 години
const NICKNAME_RE = /^[a-z0-9._]{3,30}$/

// Базовий URL для посилань у листах — з origin запиту (працює і локально, і на проді),
// з фолбеком на NEXTAUTH_URL.
function baseUrl(req: NextRequest): string {
  return req.nextUrl?.origin || process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

export async function POST(req: NextRequest) {
  const { email, password, name, role, nickname } = await req.json()

  if (!email || !password || !name || !role || !nickname) {
    return NextResponse.json({ error: 'Всі поля обовʼязкові' }, { status: 400 })
  }
  if (!['coach', 'client'].includes(role)) {
    return NextResponse.json({ error: 'Невалідна роль' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Пароль має містити щонайменше 8 символів' }, { status: 400 })
  }
  const nick = String(nickname).toLowerCase()
  if (!NICKNAME_RE.test(nick)) {
    return NextResponse.json(
      { error: 'Нікнейм: 3–30 символів, лише латинські літери, цифри, крапка та підкреслення' },
      { status: 400 }
    )
  }

  await ensureDB()

  // Email/нікнейм не повинні належати вже створеному акаунту
  const existing = await User.findOne({ $or: [{ email }, { nickname: nick }] })
  if (existing) {
    if (existing.email === email) {
      return NextResponse.json({ error: 'Email вже використовується' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Нікнейм вже зайнятий' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  // Акаунт НЕ створюємо — лише тимчасовий запис. Повторна реєстрація тим же email
  // оновлює запис і токен (новий лист).
  await PendingUser.findOneAndUpdate(
    { email },
    { email, name, role, nickname: nick, passwordHash, tokenHash, expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
    { upsert: true, new: true }
  )

  try {
    await sendVerificationEmail(email, `${baseUrl(req)}/verify-email?token=${token}`)
  } catch (e) {
    console.error('Не вдалося надіслати лист підтвердження email:', e)
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
