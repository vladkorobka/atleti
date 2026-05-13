import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

async function getCoachSession() {
  const session = await auth()
  const user = session?.user as unknown as AtletiSession
  if (!user || user.role !== 'coach') return null
  return user
}

export async function GET() {
  const user = await getCoachSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const profile = await CoachProfile.findOne({ userId: user.userId })
  return NextResponse.json({ profile })
}

export async function PUT(req: NextRequest) {
  const user = await getCoachSession()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureDB()
  const body = await req.json()
  const { bio, specializations, cancellationDeadlineHours, workingHours } = body
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: user.userId },
    { bio, specializations, cancellationDeadlineHours, workingHours },
    { upsert: true, new: true }
  )
  return NextResponse.json({ profile })
}
