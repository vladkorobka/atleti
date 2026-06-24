import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session, ClientCoach } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { sessionCreateSchema } from '@/lib/validations/coach'
import { settlePastSessions } from '@/lib/settle-sessions'

export async function GET(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  await settlePastSessions({ coachId: coachSession.userId })

  const url = new URL(req.url)
  const month = url.searchParams.get('month') // format: "2026-05"

  const query: Record<string, unknown> = { coachId: coachSession.userId }
  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 1)
    query.scheduledAt = { $gte: start, $lt: end }
  }

  const sessions = await Session.find(query).populate('clientId', 'name nickname').sort({ scheduledAt: 1 })
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const body = await req.json()
  const parsed = sessionCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { clientId, scheduledAt, duration, type } = parsed.data

  const relationship = await ClientCoach.findOne({
    clientId: parsed.data.clientId,
    coachId: coachSession.userId,
    status: 'active',
  })
  if (!relationship) {
    return NextResponse.json({ error: 'Клієнт не належить до вашого списку' }, { status: 403 })
  }

  if (new Date(parsed.data.scheduledAt) <= new Date()) {
    return NextResponse.json({ error: 'Дата заняття має бути в майбутньому' }, { status: 400 })
  }

  const newSession = await Session.create({
    clientId,
    coachId: coachSession.userId,
    scheduledAt: new Date(scheduledAt),
    duration,
    type,
    status: 'scheduled',
    createdBy: 'coach',
  })

  return NextResponse.json({ session: newSession }, { status: 201 })
}
