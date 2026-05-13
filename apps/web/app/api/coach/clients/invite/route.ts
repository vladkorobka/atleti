import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, CoachProfile, ClientCoach } from '@atleti/db'
import { canInviteClient } from '@/lib/coach-utils'
import type { AtletiSession } from '@atleti/types'
import { inviteSchema } from '@/lib/validations/coach'

export async function POST(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { nickname } = parsed.data

  await ensureDB()

  const clientUser = await User.findOne({ nickname: nickname.toLowerCase(), role: 'client' })
  if (!clientUser) return NextResponse.json({ error: 'Клієнта з таким нікнеймом не знайдено' }, { status: 404 })

  const existingActive = await ClientCoach.findOne({ clientId: clientUser._id, status: 'active' })
  if (existingActive) {
    return NextResponse.json({ error: 'Цей клієнт вже має тренера' }, { status: 409 })
  }

  const [profile, activeCount] = await Promise.all([
    CoachProfile.findOne({ userId: coachSession.userId }),
    ClientCoach.countDocuments({ coachId: coachSession.userId, status: 'active' }),
  ])

  if (!canInviteClient({ activeClients: activeCount, plan: profile?.plan ?? 'free', clientLimit: profile?.clientLimit ?? 10 })) {
    return NextResponse.json({ error: `Досягнуто ліміт клієнтів (${profile?.clientLimit ?? 10})` }, { status: 403 })
  }

  const existing = await ClientCoach.findOne({ clientId: clientUser._id, coachId: coachSession.userId })
  if (existing) {
    return NextResponse.json({ error: 'Запрошення вже надіслано' }, { status: 409 })
  }

  const invite = await ClientCoach.create({
    clientId: clientUser._id,
    coachId: coachSession.userId,
    status: 'pending',
  })

  return NextResponse.json({ invite }, { status: 201 })
}
