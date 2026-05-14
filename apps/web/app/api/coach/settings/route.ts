import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { User, CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'

export async function GET() {
  const session = await auth()
  const coachSession = session?.user as unknown as AtletiSession
  if (!coachSession || coachSession.role !== 'coach') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await ensureDB()
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const profile = await CoachProfile.findOne({ userId: coachUser._id })
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
  const coachUser = await User.findOne({ email: coachSession.email })
  if (!coachUser) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { workingHours, cancellationDeadlineHours } = await req.json()
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: coachUser._id },
    { workingHours, cancellationDeadlineHours },
    { upsert: true, new: true }
  )
  return NextResponse.json({
    workingHours: profile.workingHours,
    cancellationDeadlineHours: profile.cancellationDeadlineHours,
  })
}
