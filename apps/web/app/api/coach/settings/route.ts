import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { coachProfileSchema } from '@/lib/validations/coach'

export async function GET() {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const profile = await CoachProfile.findOne({ userId: coachSession.userId })
  return NextResponse.json({
    workingHours: profile?.workingHours ?? {},
    cancellationDeadlineHours: profile?.cancellationDeadlineHours ?? 24,
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const body = await req.json()
  const parsed = coachProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { workingHours, cancellationDeadlineHours } = parsed.data
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: coachSession.userId },
    { workingHours, cancellationDeadlineHours },
    { upsert: true, new: true }
  )
  return NextResponse.json({
    workingHours: profile.workingHours,
    cancellationDeadlineHours: profile.cancellationDeadlineHours,
  })
}
