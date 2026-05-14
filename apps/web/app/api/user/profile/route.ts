import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import bcrypt from 'bcryptjs'

async function getSession() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user?.userId) return null
  return user
}

export async function GET() {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureDB()
  const dbUser = await User.findById(user.userId).select('+passwordHash')
  if (!dbUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    name: dbUser.name,
    email: dbUser.email,
    nickname: (dbUser as any).nickname ?? '',
    hasPassword: !!(dbUser as any).passwordHash,
    isGoogle: !!(dbUser as any).googleId,
  })
}

export async function PUT(req: NextRequest) {
  const user = await getSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, email, nickname, currentPassword, newPassword } = body

  // Validate name
  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 100) {
    return NextResponse.json({ error: "Ім'я має бути від 1 до 100 символів" }, { status: 400 })
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    return NextResponse.json({ error: 'Невірний формат email' }, { status: 400 })
  }

  // Validate nickname
  const nicknameRegex = /^[a-z0-9_]{3,30}$/
  if (!nickname || !nicknameRegex.test(nickname)) {
    return NextResponse.json({ error: 'Нікнейм: 3-30 символів, лише a-z, 0-9, _' }, { status: 400 })
  }

  await ensureDB()

  const dbUser = await User.findById(user.userId).select('+passwordHash +googleId')
  if (!dbUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const normalizedEmail = email.toLowerCase().trim()
  const normalizedNickname = nickname.toLowerCase().trim()

  // Check email uniqueness
  if (normalizedEmail !== dbUser.email) {
    const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user.userId } })
    if (existing) return NextResponse.json({ error: 'Цей email вже використовується' }, { status: 400 })
  }

  // Check nickname uniqueness
  if (normalizedNickname !== (dbUser as any).nickname) {
    const existing = await User.findOne({ nickname: normalizedNickname, _id: { $ne: user.userId } })
    if (existing) return NextResponse.json({ error: 'Цей нікнейм вже зайнятий' }, { status: 400 })
  }

  // Handle password change
  const updateData: Record<string, unknown> = {
    name: name.trim(),
    email: normalizedEmail,
    nickname: normalizedNickname,
  }

  if (newPassword) {
    if ((dbUser as any).googleId) {
      return NextResponse.json({ error: 'Пароль можна встановити лише для email-акаунту' }, { status: 400 })
    }
    if (!currentPassword) {
      return NextResponse.json({ error: 'Введіть поточний пароль' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Новий пароль має бути не менше 6 символів' }, { status: 400 })
    }
    const valid = await bcrypt.compare(currentPassword, (dbUser as any).passwordHash)
    if (!valid) return NextResponse.json({ error: 'Невірний поточний пароль' }, { status: 400 })
    updateData.passwordHash = await bcrypt.hash(newPassword, 10)
  }

  await User.updateOne({ _id: user.userId }, updateData)

  return NextResponse.json({ ok: true })
}
