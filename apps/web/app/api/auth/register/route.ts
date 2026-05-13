import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { ensureDB } from '@/lib/db'
import { User } from '@atleti/db'

export async function POST(req: NextRequest) {
  const { email, password, name, role, nickname } = await req.json()

  if (!email || !password || !name || !role || !nickname) {
    return NextResponse.json({ error: 'Всі поля обовʼязкові' }, { status: 400 })
  }

  if (!['coach', 'client'].includes(role)) {
    return NextResponse.json({ error: 'Невалідна роль' }, { status: 400 })
  }

  await ensureDB()

  const existing = await User.findOne({ $or: [{ email }, { nickname: nickname.toLowerCase() }] })
  if (existing) {
    if (existing.email === email) {
      return NextResponse.json({ error: 'Email вже використовується' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Нікнейм вже зайнятий' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await User.create({ email, name, role, nickname: nickname.toLowerCase(), passwordHash })

  return NextResponse.json({ ok: true }, { status: 201 })
}
