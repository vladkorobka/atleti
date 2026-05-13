import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { ensureDB } from '@/lib/db'
import { CoachProfile } from '@atleti/db'
import type { AtletiSession } from '@atleti/types'
import { coachProfileSchema } from '@/lib/validations/coach'

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
  const parsed = coachProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }
  const { bio, specializations, cancellationDeadlineHours, workingHours } = parsed.data
  const profile = await CoachProfile.findOneAndUpdate(
    { userId: user.userId },
    { bio, specializations, cancellationDeadlineHours, workingHours },
    { upsert: true, new: true }
  )
  return NextResponse.json({ profile })
}
