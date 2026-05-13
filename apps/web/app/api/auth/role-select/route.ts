import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User } from '@atleti/db'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, nickname } = await req.json()
  if (!['coach', 'client'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  if (!nickname) return NextResponse.json({ error: 'Nickname required' }, { status: 400 })

  await ensureDB()

  const exists = await User.findOne({ nickname: nickname.toLowerCase() })
  if (exists && exists.email !== session.user.email) {
    return NextResponse.json({ error: 'Нікнейм вже зайнятий' }, { status: 409 })
  }

  await User.updateOne(
    { email: session.user.email },
    { role, nickname: nickname.toLowerCase() }
  )

  return NextResponse.json({ ok: true })
}
