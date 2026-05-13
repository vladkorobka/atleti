import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { Session } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function GET(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const url = new URL(req.url)
  const month = url.searchParams.get('month') // format: "2026-05"

  const query: Record<string, unknown> = { coachId: coachSession.userId }
  if (month) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 1)
    query.scheduledAt = { $gte: start, $lt: end }
  }

  const sessions = await Session.find(query).sort({ scheduledAt: 1 })
  return NextResponse.json({ sessions })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()

  const { clientId, scheduledAt, duration = 60, type = 'regular' } = await req.json()
  if (!clientId || !scheduledAt) {
    return NextResponse.json({ error: 'clientId and scheduledAt required' }, { status: 400 })
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
